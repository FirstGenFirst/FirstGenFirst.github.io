const through = require("through2");
const HTMLParser = require("htmlparser2");
const json2yaml = require("json2yaml");

// Sometimes Google starts blocking traffic when you send too many requests, so uncomment either one
// of these to switch which one gets used and (hopefully) Google starts letting you use it again.
// const googleTranslate = require('@k3rn31p4nic/google-translate-api');
const googleTranslate = require("translatte");

module.exports = function(type, config, lang) {

	// Handles all translation requests.
	function translate(string, fromLang, toLang) {
		let trimmedLeft = string.trimLeft();
		let trimmedRight = string.trimRight();

		// Whitespace-only strings should return immediately.
		if (!trimmedLeft) {
			return Promise.resolve(string);
		}

		let promise = new Promise(function(resolve, reject) {
			function successfulTranslation(translation) {
				translation = translation.text;
				let leftWhitespace = string.substring(0, string.length - trimmedLeft.length);
				let rightWhitespace = string.substring(trimmedRight.length);

				if ('A' <= trimmedLeft[0] && trimmedLeft[0] <= 'Z') {
					translation = translation[0].toUpperCase() + translation.substring(1);
				}

				translation = translation.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

				resolve(leftWhitespace + translation + rightWhitespace);
			}

			function failedTranslation(error) {
				console.error("Translation Failed!");
				reject(error);
			}

			googleTranslate(string, {
				from: fromLang,
				to: toLang
			}).then(successfulTranslation).catch(failedTranslation);
		})

		promise.catch(function(error) {
			
		});

		return promise;
	}


	// Translates a string of HTML.
	async function translateHTML(html, fromLang, toLang, translateByDefault) {
		// First we need to construct a DOM tree of elements and text nodes.
		let dom = {
			type: "root",
			children: [],
			translate: !!translateByDefault
		};
		let lastParent = dom;

		// A list of elements that are considered self-closing and won't have a closing tag.
		const selfClosing = [
			"area",
			"base",
			"br",
			"col",
			"embed",
			"hr",
			"img",
			"input",
			"link",
			"meta",
			"param",
			"source",
			"track",
			"wbr",
			"command",
			"keygen",
			"menuitem"
		];

		// Make the parser that will generate the DOM.
		let parser = new HTMLParser.Parser({
			onopentag: function(name, attributes) {
				let child = {
					type: "tag",
					name: name,
					attributes: attributes,
					parent: lastParent,
					children: [],
					attributes: attributes,
					translate: "translate" in attributes ? attributes.translate != "no" : lastParent.translate,
					override: attributes[`data-translate-override-${lang}`]
				};
				lastParent.children.push(child);
				lastParent = child;
			},
			onclosetag: function(name) {
				lastParent = lastParent.parent;
			},
			ontext: function(text) {
				lastParent.children.push({
					type: "text",
					value: text
				});
			}
		}, {
			decodeEntities: true,
			recognizeSelfClosing: true
		});
		// Do the parsing.
		parser.write(html);


		let promiseList = [];
		let stringDoc = [];

		// Now turn the DOM back into its stringified form, translating text nodes along the way.
		function writeChildren(node) {
			// Iterate over the current node's children.
			for (let i = 0, l = node.children.length; i < l; i++) {
				// If the current child is a text node, translate its text and add it to the string.
				if (node.children[i].type == "text") {
					let textNode = node.children[i];

					// Translate if necessary.
					if (node.translate) {
						let promise = translate(textNode.value, fromLang, toLang);
						let replacementObject = {
							value: textNode.value
						};
						stringDoc.push(replacementObject);

						promise.then(function(translation) {
							replacementObject.value = translation;
						});

						promiseList.push(promise);
					} else {
						stringDoc.push(textNode.value);
					}
				}
				// If this is an element, its tag HTML needs to be written along with its contents.
				else if (node.children[i].type == "tag") {
					const tag = node.children[i];

					stringDoc.push(`<${tag.name}`);

					// First generate its list of attributes.
					for (let name in tag.attributes) {
						// Check if this is a replacing attribute.
						// If it is, it doesn't have to appear in the final document.
						if (name.substring(0, 5) == "data-" &&
							name.substring(name.length - toLang.length - 1) == "-" + toLang) {
							continue;
						}

						let value = tag.attributes[name]

						// Check if this is a translateable attribute.
						if (tag.translate && value && value.trim() && (
							(tag.name == "th" && name == "abbr") ||
							(tag.name == "area" && name == "alt") ||
							(tag.name == "img" && name == "alt") ||
							(tag.name == "input" && name == "alt") ||
							(tag.name == "a" && name == "download") ||
							(tag.name == "area" && name == "download") ||
							(tag.name == "optgroup" && name == "label") ||
							(tag.name == "option" && name == "label") ||
							(tag.name == "track" && name == "label") ||
							(tag.name == "input" && name == "placeholder") ||
							(tag.name == "textarea" && name == "placeholder") ||
							(tag.name == "input" && tag.attributes.type == "button" && name == "value") ||
							(tag.name == "input" && tag.attributes.type == "reset" && name == "value")
						)) {
							let promise = translate(value, fromLang, toLang);
							let replacementObject = {
								value: ` ${name}="${value}"`
							};
							stringDoc.push(replacementObject);

							promise.then(function(translation) {
								replacementObject.value = ` ${name}${translation ? `="${translation}"` : ""}`;
							});

							promiseList.push(promise);
							continue;
						}

						// Check if this is an attribute that needs to be replaced.
						if (`data-${name}-${toLang}` in tag.attributes) {
							value = tag.attributes[`data-${name}-${toLang}`];
						}

						// Write out the attribute.
						stringDoc.push(` ${name}${value ? `="${value}"` : ""}`);
					}

					stringDoc.push(">");

					if (selfClosing.includes(tag.name)) {
						continue;
					}

					if (tag.translate && typeof tag.override == "string") {
						stringDoc.push(tag.override);
					} else {
						writeChildren(tag);
					}

					stringDoc.push(`</${tag.name}>`);
				}
			}
		}
		writeChildren(dom);

		await Promise.allSettled(promiseList);

		return stringDoc.map(item => typeof item.value == "string" ? item.value : item).join("");
	}


	switch (type) {
		case "collection":
			return through.obj(async function(file, encoding, callback) {
				if (file.isNull()) {
					return callback(null, file);
				} else if (file.isStream()) {
					return callback(null, file);
				} else if (file.isBuffer()) {
					// Indicate the start of a file.
					console.log(`Starting collection ${file.relative}`);

					// Clone the file to not edit the original.
					let clone = file.clone();
					// This is where the file's contents will go.
					let contents = "";

					let fm = file.frontMatter;
					let promiseList = [];

					for (const key in fm) {
						if (config.fields.includes(key) && typeof fm[key] == "string") {
							let promise = translateHTML(fm[key], "en", lang, true);

							promise.then(function(translation) {
								fm[key] = translation;
							});

							promiseList.push(promise);
						}
					}

					fm.lang = lang;

					if (config.contents) {
						let promise = translateHTML(clone.contents.toString(), "en", lang, true);

						promise.then(function(translation) {
							contents = translation;
						});

						promiseList.push(promise);
					} else {
						contents = clone.contents.toString();
					}

					await Promise.allSettled(promiseList);

					clone.contents = Buffer.from(json2yaml.stringify(fm) + "---\n" + contents, "utf-8");

					console.log(`Finished page ${file.relative}`);
					return callback(null, clone);
				}
			});

		case "page":
		default:
			const langConfig = config[lang];

			return through.obj(async function(file, encoding, callback) {
				if (file.isNull()) {
					return callback(null, file);
				} else if (file.isStream()) {
					return callback(null, file);
				} else if (file.isBuffer()) {
					// Indicate the start of a file.
					console.log(`Starting page ${file.relative}`);

					// Clone the file to not edit the original.
					let clone = file.clone();

					let fm = {};
					fm.title = langConfig.title;
					if (file.frontMatter["description-es"]) {
						fm.description = file.frontMatter["description-es"];
					}
					fm.layout = `default.${lang}`;
					fm.permalink = langConfig.permalink;
					fm.lang = lang;
					fm["lang-ref"] = config["lang-ref"];
					fm.en = file.frontMatter.permalink || "/" + config.src.replace(/\.html$/, "");

					contents = json2yaml.stringify(fm) + "---\n" + await translateHTML(clone.contents.toString(), "en", lang);

					clone.contents = Buffer.from(contents, "utf-8");

					console.log(`Finished page ${file.relative}`);
					return callback(null, clone);
				}
			});
	}
}
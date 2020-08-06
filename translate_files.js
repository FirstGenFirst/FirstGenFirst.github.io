const through = require("through2");
const HTMLParser = require("htmlparser2");
const googleTranslate = require('@k3rn31p4nic/google-translate-api')

module.exports = function(type, config, lang) {
	const langConfig = config[lang];

	// Handles all translation requests.
	function translate(string, fromLang, toLang) {
		let trimmedLeft = string.trimLeft();
		let trimmedRight = string.trimRight();

		// Whitespace-only strings should return immediately.
		if (!trimmedLeft) {
			return Promise.resolve(string);
		}

		return new Promise(function(resolve, reject) {
			googleTranslate(string, {
				from: fromLang,
				to: toLang
			}).then(function(translation) {
				translation = translation.text;
				let leftWhitespace = string.substring(0, string.length - trimmedLeft.length);
				let rightWhitespace = string.substring(trimmedRight.length);

				if ('A' <= trimmedLeft[0] && trimmedLeft[0] <= 'Z') {
					translation = translation[0].toUpperCase() + translation.substring(1);
				}

				translation = translation.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

				resolve(leftWhitespace + translation + rightWhitespace);
			}).catch(reject);
		});
	}

	switch (type) {
		case "page":
		default:
			return through.obj(async function(file, encoding, callback) {
				if (file.isNull()) {
					return callback(null, file);
				} else if (file.isStream()) {
					return callback(null, file);
				} else if (file.isBuffer()) {
					// Indicate the start of a file.
					console.log(`Starting ${file.relative}`);

					// Clone the file to not edit the original.
					let clone = file.clone();
					// This is where the file's contents will go.
					let contents = "";

					// Make a new front matter to add to the beginning of the file.
					contents +=
						`---\n`                                        +
						`title: "${langConfig.title}"\n`               +
						`layout: "default.${lang}"\n`                  +
						`permalink: "${langConfig.permalink}"\n`       +
						`lang: "${lang}"\n`                            +
						`lang-ref: "${config["lang-ref"]}"\n`          +
						`en: "${config.src.replace(/\.html$/, "")}"\n` +
						`---\n`


					// Now contruct the DOM manually and keep track of translate attributes.
					// Comments (and anything that's not a text node or element really) is excluded.
					let dom = {
						type: "root",
						children: [],
						translate: false
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
					parser.write(clone.contents.toString());


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
									let promise = translate(textNode.value, "en", lang);
									let replacementObject = {
										value: textNode.value
									};
									stringDoc.push(replacementObject);

									promise.then(function(translation) {
										replacementObject.value = translation;
									}).catch(function(e) {
										console.error(e);
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
									let simpleName = name;
									if (name.substring(0, 5) == "data-" &&
										name.substring(name.length - lang.length - 1) == "-" + lang) {
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
										let promise = translate(value, "en", lang);
										let replacementObject = {
											value: ` ${name}="${value}"`
										};
										stringDoc.push(replacementObject);

										promise.then(function(translation) {
											replacementObject.value = ` ${name}${translation ? `="${translation}"` : ""}`;
										}).catch(function(e) {
											console.error(e);
										});

										promiseList.push(promise);
										continue;
									}

									// Check if this is an attribute that needs to be replaced.
									if (`data-${name}-${lang}` in tag.attributes) {
										value = tag.attributes[`data-${name}-${lang}`];
									}

									// Write out the attribute.
									stringDoc.push(` ${name}${value ? `="${value}"` : ""}`);
								}

								stringDoc.push(">");

								if (selfClosing.includes(tag.name)) {
									continue;
								}

								if (node.translate && typeof tag.override == "string") {
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

					contents += stringDoc.map(item => item.value || item).join("");

					clone.contents = Buffer.from(contents, "utf-8");

					console.log(`Finished ${file.relative}`);
					return callback(null, clone);
				}
			});
	}
}
const gulp = require("gulp");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const frontMatter = require("front-matter");
const changedGitFiles = require("changed-git-files");
const json2yaml = require("json2yaml");
const {Translate} = require('@google-cloud/translate').v2;
const HTMLParser = require("htmlparser2");

// Set to wherever your authentication file is stored on your computer.
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.HOME + "/Documents/Auth/FirstGenFirst.org.json";
let translator = new Translate();

// Uncomment the following code for debugging/testing to avoid calling the Could Translation API and having to pay.
// let translator = {
// 	translate: function(str, lang) {
// 		return new Promise(function(resolve, reject) {
// 			setTimeout(function() {
// 				resolve([`«Mock translation (${lang}): ${str}»`]);
// 			}, 100);
// 		});
// 	}
// }

function stringToDOM(string, lang, translateByDefault, startingParent) {
	// Make the parser for the HTML
	stringToDOM.htmlParser = stringToDOM.htmlParser || new HTMLParser.Parser({
		onopentag: function(name, attributes) {
			let child = {
				type: "tag",
				name: name,
				attributes: attributes,
				parent: stringToDOM.lastParent,
				children: [],
				attributes: attributes,
				translate: "translate" in attributes ? attributes.translate != "no" : stringToDOM.lastParent.translate,
				override: attributes[`data-translate-override-${lang}`],
				containsText: false
			};
			stringToDOM.lastParent.children.push(child);
			stringToDOM.lastParent = child;
		},
		onclosetag: function(name) {
			stringToDOM.lastParent = stringToDOM.lastParent.parent;
		},
		ontext: function(text) {
			stringToDOM.lastParent.children.push({
				type: "text",
				value: text
			});
			if (text.trim()) {
				stringToDOM.lastParent.containsText = true;
			}
		}
	}, {
		decodeEntities: true,
		recognizeSelfClosing: true
	});

	if (startingParent) {
		startingParent.children = [];
	}

	let dom = startingParent || {
		type: "root",
		children: [],
		translate: Boolean(translateByDefault),
		containsText: false
	};
	stringToDOM.lastParent = dom;

	// Do the parsing.
	stringToDOM.htmlParser.write(string);

	return dom;
}

function domToString(dom, lang) {
	let string = "";

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

	// Only the passed in element's children are looked at.
	for (const child of dom.children) {
		if (child.type == "text") {
			if (dom.type == "tag" && (dom.name == "script" || dom.name == "style")) {
				string += child.value;
			} else {
				string += child.value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
			}
		} else {
			let attrString = "";
			for (const name of Object.keys(child.attributes)) {
				if (child.attributes[name] == "") {
					attrString += ` ${name}`;
				} else {
					attrString += ` ${name}="${child.attributes[name]}"`;
				}
			}

			if (selfClosing.includes(child.name)) {
				string += `<${child.name}${attrString}/>`;
			} else {
				string += `<${child.name}${attrString}>`;
				string += domToString(child);
				string += `</${child.name}>`;
			}
		}
	}

	return string;
}

function translateHTML(string, lang, translateByDefault, filename) {
	if (!string.trim()) {
		return Promise.resolve(string);
	}

	let dom = stringToDOM(string, lang, translateByDefault);

	return _translateHTML(dom, lang, filename).then(function() {
		fixAttributes(dom, lang);
		return domToString(dom);
	});
}

function _translateHTML(parent, lang, filename) {
	if (parent.type == "text") {
		// Text nodes get translated by their parents and don't need to be re-translated.
		return Promise.resolve();
	}

	if (parent.override) {
		// If the parent defines on override, it is used and no manual translating needs to be done.
		// Note this a translation-override will still be respected, even if the element's translate attribute is not set to yes.
		return new Promise(function(resolve, reject) {
			stringToDOM(parent.override, lang, false, parent);
			resolve();
		});
	}

	if (parent.parent && parent.parent.translate && parent.parent.containsText) {
		// If this element's parent has already been translated, there's no need to re-translate this element.
		return Promise.resolve();
	}
	
	if (parent.translate && parent.containsText) {
		return new Promise(function(resolve, reject) {
			// Translate this element.
			let input = domToString(parent, lang);
			translator.translate(input, lang).then(function(data) {
				data = data[0];
				data = Array.isArray(data) ? data[0] : data;
				stringToDOM(data, lang, false, parent);

				let promises = [];
				for (const child of parent.children) {
					promises.push(_translateHTML(child, lang));
				}
				Promise.all(promises).then(function() {
					resolve(...arguments);
				}).catch(function() {
					reject(...arguments);
				});
			}).catch(function(e) {
				reject(`There was an error translating ${filename}:\n  ${e}`);
			});
		});
	} else {
		let promises = [];
		for (const child of parent.children) {
			promises.push(_translateHTML(child, lang));
		}
		return Promise.all(promises);
	}
}

function fixAttributes(parent, lang) {
	for (const child of parent.children) {
		if (child.type == "text") {
			continue;
		}
		for (const name of Object.keys(child.attributes)) {
			if (name == "data-translate-override-" + lang) {
				delete child.attributes[name];
			} else if (name.substring(0,5) == "data-" && name.substring(name.length - 1 - lang.length) == "-" + lang) {
				child.attributes[name.substring(5, name.length - 1 - lang.length)] = child.attributes[name];
				delete child.attributes[name];
			}
		}
		fixAttributes(child, lang);
	}
}

function _translate(config, changed) {
	return new Promise(function(resolve, reject) {
		let promises = [];

		let translatableCollections = [];
		let translatableFields = {};
		for (const name of Object.keys(config.collections)) {
			let collection = config.collections[name];
			if (collection.translate) {
				translatableCollections.push("_" + name);
				translatableFields["_" + name] = collection.translate;
			}
		}

		for (const file of changed) {
			let dir = path.normalize(path.dirname(file.filename));
			let pathdirs = dir.split(path.sep);
			if (translatableCollections.includes(pathdirs[0])) {
				if (pathdirs.length == 1 || !config.translations.includes(pathdirs[1])) {
					promises.push(translateCollection(file.filename, translatableFields[dir], config.translations, dir));
				}
			} else if (!config.translations.includes(pathdirs[0])) {
				let promise = translatePage(path.normalize(file.filename), config.translations)
				promises.push(promise);
			}
		}

		Promise.allSettled(promises).then(function(results) {
			for (const result of results) {
				if (result.status == "rejected") {
					reject();
				}
			}
			resolve();
		});
	});
}

function translateCollection(filename, fields, langs, dir) {
	return new Promise(function(resolve, reject) {
		readFile(filename).then(function(data) {
			console.info("Starting " + filename);

			const basename = path.basename(filename);

			let fm = frontMatter(data);
			let translatedFm = {};
			let translatedBody = {};

			let promises = [];

			for (const lang of langs) {
				translatedFm[lang] = Object.assign({}, fm.attributes);
				translatedBody[lang] = fm.body;
				for (const field of fields) {
					if (field == "content") {
						promises.push(translateHTML(fm.body, lang, true, filename).then(function(translation) {
							translatedBody[lang] = translation;
						}));
					} else if (typeof fm.attributes[field] == "string") {
						promises.push(translateHTML(fm.attributes[field], lang, true, filename).then(function(translation) {
							translatedFm[lang][field] = translation;
						}));
					}
				}
			}

			let finished = Promise.all(promises).then(function() {
				let promises = [];
				for (const lang of langs) {
					if (lang in translatedFm && lang in translatedBody) {
						const content = json2yaml.stringify(translatedFm[lang]) + "---\n" + translatedBody[lang];
						promises.push(writeFile(`${dir}/${lang}/${basename}`, content).catch(function(e) {
							return `Error writing file ${dir}/${lang}/${basename}:\n  ${e}`;
						}));
					} else {
						console.warn(`No output for ${dir}/${lang}/${basename}`);
					}
				}
				Promise.allSettled(promises).then(function(results) {
					let succeeded = true;
					for (const result of results) {
						if (result.status == "rejected") {
							succeeded = false;
							console.error(result.reason);
						}
					}
					if (succeeded) {
						console.info(`\u001b[38;5;121mFinished ${filename}\u001b[0m`);
						resolve();
					} else {
						reject();
					}
				});
			}).catch(function(e) {
				console.error(`Could not translate file ${filename}:\n  ${e}`);
				reject();
			});
		}).catch(function(e) {
			console.error(`Could not translate file ${filename}:\n  ${e}`);
			reject();
		});
	});
}

function translatePage(filename, langs, dir) {
	return new Promise(function(resolve, reject) {
		readFile(filename).then(function(data) {
			if (frontMatter.test(data)) {
				let fm = frontMatter(data);
				let langsToDo = [];

				for (const lang of langs) {
					if (fm.attributes[lang]) {
						langsToDo.push(lang);
					}
				}

				if (langsToDo.length > 0) {
					console.info("Starting " + filename);

					let translatedFm = {};
					let translatedBody = {};

					let promises = [];

					for (const lang of langsToDo) {
						translatedFm[lang] = Object.assign({}, fm.attributes);
						delete translatedFm[lang][lang];
						translatedFm[lang].en = {permalink: fm.attributes.permalink};
						translatedFm[lang].lang = lang;
						translatedFm[lang].layout = fm.attributes.layout + "." + lang;
						Object.assign(translatedFm[lang], fm.attributes[lang]);

						promises.push(translateHTML(fm.body, lang, false, filename).then(function(translation) {
							translatedBody[lang] = translation;
							const content = json2yaml.stringify(translatedFm[lang]) + "---\n" + translatedBody[lang];
							return writeFile(`${lang}/${filename}`, content).catch(function(e) {
								return `Error writing file ${lang}/${filename}:\n  ${e}`;
							});
						}).catch(function(e) {
							console.error(`Could not translate file ${filename}: \n  ${e}`);
							reject();
						}));
					}

					Promise.allSettled(promises).then(function(results) {
						let succeeded = true;
						for (const result of results) {
							if (result.status == "rejected") {
								succeeded = false;
								console.error(result.reason);
							}
						}
						if (succeeded) {
							console.info(`\u001b[38;5;121mFinished ${filename}\u001b[0m`);
							resolve();
						} else {
							reject();
						}
					});
				} else {
					resolve();
				}
			} else {
				resolve();
			}
		}).catch(function(e) {
			console.error(`Could not translate file ${filename}:\n  ${e}`);
			reject();
		});
	});
}

function readFile(filename) {
	return new Promise(function(resolve, reject) {
		fs.readFile(filename, "utf-8", function(err, result) {
			if (err == null) {
				resolve(result);
			} else {
				reject(err);
			}
		});
	});
}

function writeFile(filename, content) {
	return new Promise(function(resolve, reject) {
		fs.writeFile(filename, content, "utf-8", function(err) {
			if (err == null) {
				resolve();
			} else {
				reject(err);
			}
		});
	});
}

// Translates any files that have been changed since the last commit.
// Collections will also be translated based on their "translate" property in _config.yml.
exports.translate = function translate(cb) {
	let config;
	let changed;

	fs.readFile("./_config.yml", "utf-8", function(err, result) {
		if (err == null) {
			try {
				config = yaml.safeLoad(result);
			} catch (e) {
				return cb(e);
			}
			check();
		}
	});

	changedGitFiles(function(err, results) {
		if (err == null) {
			changed = results.filter(file => file.status != "Deleted");
			check();
		}
	});

	function check() {
		if (config && changed) {
			try {
				_translate(config, changed).then(function() {
					cb();
				}).catch(function(e) {
					return cb(e);
				});
			} catch (e) {
				return cb(e);
			}
		}
	}
}
const gulp = require("gulp");
const childprocess = require("child_process");
const util = require("gulp-util");
const fs = require("fs");
const yaml = require("js-yaml");
const merge = require("merge-stream");
const frontMatter = require("gulp-front-matter");

const translateFiles = require("./translate_files")

exports.jekyll = function jekyll(cb) {
	const jekyll = childprocess.spawn(
		"bundle", ["exec", "jekyll", "serve", "--watch", "--incremental", "--drafts"]
	);

	const jekyllLog = function(buffer) {
		buffer.toString()
			.split(/\n/)
			.forEach(function(line) {
				util.log(line);
			});
	};

	jekyll.stdout.on("data", jekyllLog);
	jekyll.stderr.on("data", jekyllLog);

	cb();
};

exports.translate = function translate() {
	let translations;
	try {
		translations = yaml.safeLoad(fs.readFileSync("./_config.yml", "utf-8")).translations;
	} catch (e) {
		return cb(e);
	}

	let streams = [];

	for (let i = translations.langs.length - 1; i >= 0; i--) {
		for (let j = translations.pages.length - 1; j >= 0; j--) {
			streams.push(
				gulp.src(translations.pages[j].src)
					.pipe(frontMatter({
						remove: true
					}))
					.pipe(translateFiles(
						"page",
						translations.pages[j],
						translations.langs[i]
					))
					.pipe(gulp.dest(translations.langs[i] + "/"))
			);
		}
	}

	return merge(streams);
};

exports.default = exports.jekyll;
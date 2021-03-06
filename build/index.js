#!/usr/bin/env node

const fs = require('fs');
const { spawn } = require('child_process');
const rimraf = require('rimraf');
const path = require('path');
const rollup = require('rollup');
const sass = require('sass');
const typescript = require('rollup-plugin-typescript2');
const json = require('@rollup/plugin-json');
const nodeResolve = require('rollup-plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const options = require('minimist')(process.argv.slice(2), {
	default: {
		'web-ext': false,
		watch: false,
	},
});
options.webExt = options['web-ext'];

// Manifest
let mainManifest = require('../manifest.json');
mainManifest.version = process.env.npm_package_version;
const browsers = ['firefox', 'chrome'];
let browser_manifests = {
	firefox: {
		applications: {
			gecko: {
				id: 'syncdex@glagan',
				strict_min_version: '61.0',
			},
		},
		// Required permissions for Containers
		permissions: ['webRequest', 'webRequestBlocking', 'cookies'],
	},
};

//
const Files = [
	'dist:dist',
	'build/css:css',
	'icons:icons',
	// Background
	'build/scripts/SyncDex_background.js:background',
	'src/background/index.html:background',
	// Options
	'build/scripts/SyncDex_options.js:options',
	'src/Options/index.html:options',
	'build/scripts/SyncDex_Anilist.js:external',
	'build/scripts/SyncDex_Token.js:external',
	'build/scripts/SyncDex.js',
];

// Startup
// prettier-ignore
const RED = 91, GREEN = 92, ORANGE = 93, BLUE = 94, MAGENTA = 95, CYAN = 96;
const color = (code) => `\u001b[${code}m`;
const reset = () => `\u001b[0m`;
const optionColor = (option, content = undefined, theme = [GREEN, ORANGE]) =>
	`${option ? color(theme[0]) : color(theme[1])}${content ? content : option}${reset()}`;
console.log(
	`${color(CYAN)}SyncDex ${mainManifest.version}${reset()} :: web-ext: ${optionColor(
		options.webExt
	)} | watch: ${optionColor(options.watch)} `
);

// Compile and Build
let bundleList = [
	{
		name: 'SyncDex',
		input: 'src/SyncDex/index.ts',
		output: 'build/scripts/SyncDex.js',
	},
	{
		name: 'Background',
		input: 'src/Background/index.ts',
		output: 'build/scripts/SyncDex_background.js',
	},
	{
		name: 'Options',
		input: 'src/Options/index.ts',
		output: 'build/scripts/SyncDex_options.js',
	},
	{
		name: 'Anilist',
		input: 'src/External/Anilist.ts',
		output: 'build/scripts/SyncDex_Anilist.js',
	},
	{
		name: 'Token',
		input: 'src/External/SyncDex.ts',
		output: 'build/scripts/SyncDex_Token.js',
	},
];
const bundles = bundleList.map((bundle) => {
	return {
		input: bundle.input,
		external: ['SimpleNotification'],
		plugins: (() => {
			let list = [
				typescript({ cacheRoot: 'build/.cache' }),
				json({ preferConst: true }),
				nodeResolve({ browser: true }),
				commonjs(),
			];
			// if (options.mode == 'prod' || options.mode == 'production') {
			// 	list.push(terser({ mangle: { keep_classnames: true } }));
			// }
			return list;
		})(),
		output: {
			//dir: `build/scripts/`,
			file: bundle.output,
			format: 'es',
			sourcemap: 'inline',
		},
		watch: {
			buildDelay: 1000,
			clearScreen: false,
			chokidar: false,
			exclude: ['node_modules/**/*', 'build/**/*', 'dist/**/*'],
		},
	};
});
function bundleName(outputFile) {
	const file = /.+\\(.+)\.js$/.exec(outputFile)[1];
	if (file == 'SyncDex') return 'SyncDex';
	const name = /SyncDex_(.+)/.exec(file)[1];
	return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

// SCSS Files
const scss = ['SyncDex', 'Options'];

// Multiline async compilations
let promises = [];
let lines = [];
let queuedUpdate = false;
let updatingLine;
const updateLine = async () => {
	if (queuedUpdate) return;
	if (updatingLine !== undefined) {
		queuedUpdate = true;
		await updatingLine;
	}
	updatingLine = new Promise((resolve) => {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write(lines.join(`\n`));
		queuedUpdate = false;
		updatingLine = undefined;
		resolve();
	});
};
const clearLine = () => {
	updatingLine = undefined;
	promises = [];
	lines = [];
};
const waitLine = async () => {
	await Promise.all(promises);
	process.stdout.write(`\n`);
	clearLine();
};

// Start
(async () => {
	// Build CSS
	let start = Date.now();
	console.log(`${color(MAGENTA)}Compiling CSS${reset()}`);
	clearLine();
	scss.forEach((name, index) => {
		lines[index] = `\t${color(CYAN)}${name}${reset()}...`;
		updateLine();
		promises.push(
			new Promise((resolve) => {
				const result = sass.renderSync({
					file: `css/${name}.scss`,
					outFile: `${name}.css`,
					includePaths: ['css'],
					sourceMap: true,
					sourceMapEmbed: true,
					outputStyle: options.webExt ? 'compressed' : 'expanded',
				});
				fs.writeFileSync(`build/css/${name}.css`, result.css.toString());
				//fs.writeFileSync(`build/css/${name}.css.map`, result.map.toString());
				lines[index] = `${lines[index]} done in ${result.stats.duration}ms`;
				updateLine();
				resolve();
			})
		);
	});
	await waitLine();
	// Compile modules
	const watcher = rollup.watch(bundles);
	let doneInitial = false;
	let duration = 0;
	watcher.on('event', async (event) => {
		if (event.code == 'START') {
			if (doneInitial) start = Date.now();
			console.log(`${color(MAGENTA)}Compiling Scripts${reset()}`);
			duration = 0;
		} else if (event.code == 'BUNDLE_START') {
			rimraf.sync(event.output[0]); // Delete previous file
			//if (options.mode == 'dev') rimraf.sync(`${event.output[0]}.map`);
			process.stdout.write(`\t${color(CYAN)}${bundleName(event.output[0])}${reset()}...`);
		} else if (event.code == 'BUNDLE_END') {
			process.stdout.write(` done in ${color(BLUE)}${event.duration}ms${reset()}\n`);
			duration += event.duration;
		} else if (event.code == 'ERROR') {
			process.stdout.write(`\n# ${event.error}`);
			if (event.error.pluginCode) process.stdout.write(` (${event.error.pluginCode})`);
			if (event.error.loc) {
				process.stdout.write(
					`\n# File ${event.error.loc.file}:${event.error.loc.line} line ${event.error.loc.column}`
				);
			}
			if (event.error.frame) process.stdout.write(`${event.error.frame}\n`);
			else process.stdout.write(`\n`);
			duration = 0;
		} else if (event.code == 'END') {
			console.log(`${color(GREEN)}Compiled all modules in${reset()} ${color(BLUE)}${duration}ms${reset()}`);
			const extStart = Date.now();
			process.stdout.write(`${color(MAGENTA)}Building extensions${reset()}...`);
			// Build for each browsers
			const promises = [];
			for (const browser of browsers) {
				promises.push(buildExtension(browser, doneInitial));
			}
			await Promise.all(promises);
			process.stdout.write(` done in ${color(BLUE)}${Date.now() - extStart}ms${reset()}\n`);
			const zeroPad = (n) => `00${n}`.slice(-2);
			const now = new Date();
			console.log(
				`${color(GREEN)}Done at ${color(BLUE)}${zeroPad(now.getHours())}h${zeroPad(
					now.getMinutes()
				)}min${zeroPad(now.getSeconds())}s${color(GREEN)} in ${reset()}${color(BLUE)}${
					now.getTime() - start
				}ms${reset()}`
			);
			if (!doneInitial) {
				if (!options.watch) {
					watcher.close();
				} else console.log(`${color(GREEN)}Watching folders (CTRL + C to exit)${reset()}`);
				doneInitial = true;
			}
		}
	});
})();

// Create manifest, move files and build web-ext for a single Browser
async function buildExtension(browser, nonVerbose) {
	// Create temp folder for the bundle
	let folderName = `build/${browser}`;
	if (fs.existsSync(folderName)) {
		rimraf.sync(folderName);
	}
	fs.mkdirSync(folderName);
	// Merge manifests
	let manifest = JSON.parse(JSON.stringify(mainManifest));
	if (browser_manifests[browser]) {
		for (const key in browser_manifests[browser]) {
			const value = browser_manifests[browser][key];
			if (manifest[key] === undefined) {
				manifest[key] = value;
			} else if (Array.isArray(manifest[key])) {
				manifest[key].push(...value);
			} else if (typeof manifest[key] === 'object') {
				Object.assign(manifest[key], value);
			} else manifest[key] = value;
		}
	}
	// Write in file
	let bundleManifestStream = fs.createWriteStream(`${folderName}/manifest.json`, {
		flags: 'w+',
	});
	bundleManifestStream.write(JSON.stringify(manifest));
	bundleManifestStream.cork();
	bundleManifestStream.end();
	deepFileCopy(Files, folderName, ['chrome', 'firefox']);

	// Make web-ext
	if (options.webExt) {
		const child = spawn(
			process.platform === 'win32' ? 'web-ext.cmd' : 'web-ext',
			[
				'build',
				'--source-dir',
				folderName,
				'--artifacts-dir',
				'web-ext-artifacts',
				'--filename',
				`syncdex_${manifest.version}_${browser}.zip`,
				'--overwrite-dest',
			],
			{ windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
		);
		child.stderr.on('data', (data) => {
			console.error(`${color(RED)}${data}${reset()}`);
		});
		await new Promise((resolve) => {
			child.on('close', function (data) {
				resolve();
			});
		});
	}
}

/**
 * Copy *file:path_in_extension*
 * If path_in_extension is set, the file will be moved to the path
 * If it's not set it will have the same original path
 */
function deepFileCopy(bases, destination, ignore = []) {
	if (!Array.isArray(bases)) bases = [bases];
	if (!fs.existsSync(destination)) {
		fs.mkdirSync(destination);
	}
	for (const currentBase of bases) {
		const parts = currentBase.split(':');
		const base = parts[0];
		if (fs.statSync(base).isFile()) {
			let destinationBase = destination;
			if (parts.length == 2 && parts[1].length) {
				destinationBase = `${destination}/${parts[1]}`;
				if (!fs.existsSync(destinationBase)) {
					fs.mkdirSync(destinationBase);
				}
			}
			let currentDestination = `${destinationBase}/${path.basename(base)}`;
			// console.log(`> '${base}' into '${destinationBase}'`);
			fs.copyFileSync(base, currentDestination);
		} else {
			fs.readdirSync(base).forEach((file) => {
				// Return if it"s an ignored file
				if (ignore.indexOf(file) >= 0) return;
				// Create dir if it doesn"t exist
				let destinationBase = destination;
				if (parts.length == 2 && parts[1].length) {
					destinationBase = `${destination}/${parts[1]}`;
					if (!fs.existsSync(destinationBase)) {
						fs.mkdirSync(destinationBase);
					}
				}
				// Move files
				let currentFolder = `${base}/${file}`;
				let currentDestination = `${destinationBase}/${file}`;
				if (fs.statSync(currentFolder).isDirectory()) {
					deepFileCopy(currentFolder, currentDestination, ignore);
				} else if (path.extname(currentDestination) != '.ts') {
					// console.log(`> '${file}' into '${destination}'`);
					fs.copyFileSync(currentFolder, currentDestination);
				}
			});
		}
	}
}

#!/usr/bin/env node
const fs = require('fs');
const exec = require('child_process');
const rimraf = require('rimraf');
const path = require('path');
const rollup = require('rollup');
const sass = require('sass');
const typescript = require('@rollup/plugin-typescript');
const { terser } = require('rollup-plugin-terser');
const options = require('minimist')(process.argv.slice(2), {
	default: {
		'web-ext': false,
		mode: 'dev',
		watch: false,
	},
});
options.webExt = options['web-ext'];

// Manifest
let mainManifest = {
	manifest_version: 2,
	name: 'SyncDex',
	version: '0.1',
	author: 'Glagan',
	description: 'Automatically update your Manga lists when reading on MangaDex.',
	permissions: [
		'http://127.0.0.1/*', // !
		'http://localhost/mochi-v2/api/*', // !
		'https://myanimelist.net/manga/*',
		'https://myanimelist.net/ownlist/manga/*',
		'https://mangadex.org/*',
		'https://graphql.anilist.co/',
		'https://kitsu.io/api/*',
		'https://*.mangaupdates.com/series.html?id=*',
		'https://*.mangaupdates.com/ajax/*',
		'https://*.anime-planet.com/manga/*',
		'https://*.anime-planet.com/api/*',
		'storage',
	],
	icons: {
		48: 'icons/48.png',
		96: 'icons/96.png',
		128: 'icons/128.png',
	},
	background: {
		page: 'background/index.html',
	},
	content_scripts: [
		{
			matches: ['https://anilist.co/api/v2/oauth/pin?syncdex*'],
			js: ['dist/SimpleNotification.js', 'external/SyncDex_Anilist.js'],
			css: ['dist/SimpleNotification.min.css'],
		},
		{
			matches: [
				'https://*.mangadex.org/follows*',
				'https://*.mangadex.org/manga*',
				'https://*.mangadex.org/titles*',
				'https://*.mangadex.org/title*',
				'https://*.mangadex.org/chapter/*',
				'https://*.mangadex.org/search*',
				'https://*.mangadex.org/?page=search*',
				'https://*.mangadex.org/?page=titles*',
				'https://*.mangadex.org/featured',
				'https://*.mangadex.org/group*',
				'https://*.mangadex.org/genre*',
				'https://*.mangadex.org/user*',
				'https://*.mangadex.org/list*',
				'https://*.mangadex.org/updates*',
				'https://*.mangadex.org/history*',
			],
			js: ['dist/SimpleNotification.js', 'SyncDex.js'],
			css: ['dist/SimpleNotification.min.css', 'css/SyncDex.css'],
		},
	],
	browser_action: {
		default_icon: {
			48: 'icons/48.png',
			96: 'icons/96.png',
			128: 'icons/128.png',
		},
		default_title: 'SyncDex',
	},
	options_ui: {
		page: 'options/index.html',
		open_in_tab: true,
	},
};
const browsers = ['firefox', 'chrome'];
let browser_manifests = {
	firefox: {
		applications: {
			gecko: {
				id: 'syncdex@glagan',
				strict_min_version: '61.0',
			},
		},
		options_ui: {
			page: 'options/index.html',
			open_in_tab: true,
		},
	},
	chrome: {
		options_ui: {
			page: 'options/index.html',
			open_in_tab: true,
		},
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
	'build/scripts/SyncDex.js',
];
const DevFiles = [
	'build/scripts/SyncDex_background.js.map:background',
	'build/scripts/SyncDex_options.js.map:options',
	'build/scripts/SyncDex.js.map',
	'build/scripts/SyncDex_Anilist.js.map:external',
];

// Startup
// prettier-ignore
const RED = 91, GREEN = 92, ORANGE = 93, BLUE = 94;
const optionColor = (option, content = undefined, theme = [GREEN, ORANGE]) =>
	`${option ? `\u001b[${theme[0]}m` : `\u001b[${theme[1]}m`}${content ? content : option}\u001b[0m`;
console.log(
	`\u001b[96mSyncDex ${mainManifest.version}\u001b[0m :: mode: ${optionColor(options.mode == 'prod', options.mode, [
		GREEN,
		BLUE,
	])} | web-ext: ${optionColor(options.webExt)} | watch: ${optionColor(options.watch)} `
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
		name: 'External',
		input: 'src/External/Anilist.ts',
		output: 'build/scripts/SyncDex_Anilist.js',
	},
];
const bundles = bundleList.map((bundle) => {
	return {
		input: bundle.input,
		// external: ['SimpleNotification'],
		plugins: (() => {
			let list = [typescript()];
			if (options.mode == 'prod' || options.mode == 'production') {
				list.push(terser());
			}
			return list;
		})(),
		output: {
			file: bundle.output,
			format: 'es',
			sourcemap: options.mode == 'dev',
		},
		watch: {
			buildDelay: 750,
			clearScreen: false,
			chokidar: false,
			exclude: ['node_modules/**/*', 'build/**/*', 'dist/**/*'],
		},
	};
});
function bundleName(outputFile) {
	const file = /.+\\(.+)$/.exec(outputFile)[1];
	return bundleList.find((bundle) => {
		return bundle.output.indexOf(file) >= 0;
	}).name;
}

// SCSS Files
const scss = ['SyncDex', 'Options'];

// Start
(async () => {
	// Build CSS
	console.log('Compiling CSS...');
	scss.forEach((name) => {
		process.stdout.write(`~ ${name}...`);
		const result = sass.renderSync({
			file: `css/${name}.scss`,
			outFile: `${name}.css`,
			includePaths: ['css'],
			sourceMap: true,
			outputStyle: options.mode == 'dev' ? 'expanded' : 'compressed',
		});
		fs.writeFileSync(`build/css/${name}.css`, result.css.toString());
		fs.writeFileSync(`build/css/${name}.css.map`, result.map.toString());
		process.stdout.write(` done in ${result.stats.duration}ms\n`);
	});
	// Compile modules
	const watcher = rollup.watch(bundles);
	let doneInitial = false;
	let duration = 0;
	watcher.on('event', async (event) => {
		if (event.code == 'START') {
			console.log(`Compiling Scripts`);
			duration = 0;
		} else if (event.code == 'BUNDLE_START') {
			rimraf.sync(event.output[0]); // Delete previous file
			if (options.mode == 'dev') rimraf.sync(`${event.output[0]}.map`);
			process.stdout.write(`~ ${bundleName(event.output[0])}...`);
		} else if (event.code == 'BUNDLE_END') {
			process.stdout.write(` done in ${event.duration}ms\n`);
			duration += event.duration;
		} else if (event.code == 'ERROR') {
			process.stdout.write(`\n# ${event.error}`);
			if (event.error.pluginCode) process.stdout.write(` (${event.error.pluginCode})`);
			if (event.error.loc) {
				process.stdout.write(
					`\n# File ${event.error.loc.file}:${event.error.loc.line} line ${event.error.loc.column}`
				);
			}
			if (event.error.frame) process.stdout.write(`${event.error.frame}`);
			duration = 0;
			if (!options.watch) watcher.close();
			return false;
		} else if (event.code == 'END') {
			console.log(`Compiled all modules in ${duration}ms`);
			console.log(`Building extensions`);
			// Build for each browsers
			for (const browser of browsers) {
				await buildExtension(browser, doneInitial);
			}
			const zeroPad = (n) => `00${n}`.slice(-2);
			const now = new Date();
			console.log(
				`Done at ${zeroPad(now.getHours())}h${zeroPad(now.getMinutes())}min${zeroPad(now.getSeconds())}s`
			);
			if (!doneInitial) {
				if (!options.watch) {
					watcher.close();
				} else console.log(`Watching folders (CTRL + C to exit)`);
				doneInitial = true;
			}
		}
	});
})();

// Create manifest, move files and build web-ext for a single Browser
async function buildExtension(browser, nonVerbose) {
	const start = Date.now();
	process.stdout.write(`~ ${browser}...`);
	// Create temp folder for the bundle
	let folderName = `build/${browser}`;
	if (fs.existsSync(folderName)) {
		rimraf.sync(folderName);
	}
	fs.mkdirSync(folderName);

	// Merge manifests
	let manifest = Object.assign({}, mainManifest, browser_manifests[browser]);
	// Write in file
	let bundleManifestStream = fs.createWriteStream(`${folderName}/manifest.json`, {
		flags: 'w+',
	});
	bundleManifestStream.write(JSON.stringify(manifest));
	bundleManifestStream.cork();
	bundleManifestStream.end();

	if (options.mode == 'dev') {
		Files.unshift('src:src');
		Files.push(...DevFiles);
	}
	deepFileCopy(Files, folderName, ['chrome', 'firefox']);

	// Make web-ext
	if (options.webExt) {
		if (!nonVerbose) process.stdout.write(` web-ext...`);
		console.log(`${p} Building ${browser} web-ext`);
		const execResult = await execPromise(
			exec(`web-ext build --source-dir ${folderName} --artifacts-dir web-ext-artifacts`)
		)
			.then(() => {
				if (!fs.existsSync('build')) {
					fs.mkdirSync('build');
				}
				fs.renameSync(
					`web-ext-artifacts/syncdex-${manifest.version}.zip`,
					`web-ext-artifacts/syncdex_${manifest.version}_${browser}.zip`
				);
				rimraf.sync(`${folderName}/web-ext-artifacts`);
				return true;
			})
			.catch((error) => {
				console.error(error);
				return false;
			});
		if (!execResult) {
			return;
		}
	}
	process.stdout.write(` done in ${Date.now() - start}ms\n`);
}

// Promisify exec -- see https://stackoverflow.com/a/30883005
function execPromise(child) {
	return new Promise((resolve, reject) => {
		child.addListener('error', reject);
		child.addListener('exit', resolve);
	});
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
				} else if (options.mode == 'dev' || path.extname(currentDestination) != '.ts') {
					// console.log(`> '${file}' into '${destination}'`);
					fs.copyFileSync(currentFolder, currentDestination);
				}
			});
		}
	}
}

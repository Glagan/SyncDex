#!/usr/bin/env node
const fs = require('fs');
const exec = require('child_process');
const rimraf = require('rimraf');
const path = require('path');
const loadConfigFile = require('rollup/dist/loadConfigFile');
const rollup = require('rollup');
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
		'https://*.myanimelist.net/manga/*',
		'https://*.myanimelist.net/ownlist/manga/*',
		'https://*.mangadex.org/*',
		'https://graphql.anilist.co/',
		'https://kitsu.io/api/*',
		'https://*.mangaupdates.com/series.html?id=*',
		'https://*.mangaupdates.com/ajax/*',
		'https://*.anime-planet.com/manga/*',
		'https://*.anime-planet.com/api/*',
		'storage',
	],
	icons: {
		48: 'icons/sc.png',
		96: 'icons/sc.png',
		128: 'icons/sc.png',
	},
	background: {
		page: 'background/index.html',
	},
	content_scripts: [
		{
			matches: ['https://anilist.co/api/v2/oauth/pin?syncdex*'],
			js: ['dist/simpleNotification.min.js', 'external/SyncDex_Anilist.js'],
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
			],
			js: ['dist/simpleNotification.min.js', 'SyncDex.js'],
			css: ['dist/simpleNotification.min.css', 'SyncDex.css'],
		},
	],
	browser_action: {
		default_icon: {
			48: 'icons/sc.png',
			96: 'icons/sc.png',
			128: 'icons/sc.png',
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

// Startup
// 91 red 92 green 93 orange 94 blue
const optionColor = (option, content = undefined, theme = [92, 93]) =>
	`${option ? `\u001b[${theme[0]}m` : `\u001b[${theme[1]}m`}${content ? content : option}\u001b[0m`;
console.log(
	`\u001b[96mSyncDex ${mainManifest.version}\u001b[0m :: mode: ${optionColor(options.mode == 'prod', options.mode, [
		92,
		94,
	])} | web-ext: ${optionColor(options.webExt)} | watch: ${optionColor(options.watch)} `
);

// Compile and Build
let bundleList = [
	{
		name: 'Core',
		input: 'src/index.ts',
		output: 'build/SyncDex.js',
	},
	{
		name: 'Background',
		input: 'background/index.ts',
		output: 'build/SyncDex_background.js',
	},
	{
		name: 'Options',
		input: 'options/index.ts',
		output: 'build/SyncDex_options.js',
	},
	{
		name: 'External',
		input: 'external/Anilist.ts',
		output: 'build/SyncDex_Anilist.js',
	},
];
const bundles = bundleList.map((bundle) => {
	return {
		input: bundle.input,
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
			exclude: ['node_modules/**', 'build/**'],
		},
	};
});
function bundleName(outputFile) {
	const file = /.+\\(.+)$/.exec(outputFile)[1];
	return bundleList.find((bundle) => {
		return bundle.output.indexOf(file) >= 0;
	}).name;
}

// Start
(async () => {
	// Compile modules
	const watcher = rollup.watch(bundles);
	let doneInitial = false;
	let duration = 0;
	watcher.on('event', async (event) => {
		if (event.code == 'START') {
			console.log(`Compiling`);
			duration = 0;
		} else if (event.code == 'BUNDLE_START') {
			rimraf.sync(event.output[0]); // Delete previous file
			if (options.mode == 'dev') rimraf.sync(`${event.output[0]}.map`);
			process.stdout.write(`~ ${bundleName(event.output[0])}...`);
		} else if (event.code == 'BUNDLE_END') {
			process.stdout.write(` done in ${event.duration}ms\n`);
			duration += event.duration;
		} else if (event.code == 'ERROR') {
			process.stdout.write(`\n# ${event.error} (${event.error.pluginCode})`);
			process.stdout.write(
				`\n# File ${event.error.loc.file}:${event.error.loc.line} line ${event.error.loc.column}`
			);
			process.stdout.write(`${event.error.frame}`);
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
			console.log('Done');
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

	const files = [
		'dist:dist',
		'icons:icons',
		'options:options',
		'background:background',
		'src/SyncDex.css',
		'build/scripts/SyncDex_background.js:background',
		'build/scripts/SyncDex_options.js:options',
		'build/scripts/SyncDex.js',
		'build/scripts/SyncDex_Anilist.js:external',
	];
	if (options.mode == 'dev') {
		files.unshift('src:src');
		files.push(
			'build/scripts/SyncDex_background.js.map:background',
			'build/scripts/SyncDex_options.js.map:options',
			'build/scripts/SyncDex.js.map',
			'build/scripts/SyncDex_Anilist.js.map:external'
		);
	}
	deepFileCopy(files, folderName, ['chrome', 'firefox']);

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

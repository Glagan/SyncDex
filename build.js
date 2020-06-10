#!/usr/bin/env node
const fs = require('fs');
const exec = require('child_process');
const rimraf = require('rimraf');
const path = require('path');
const loadConfigFile = require('rollup/dist/loadConfigFile');
const rollup = require('rollup');
const typescript = require('@rollup/plugin-typescript');
const terser = require('rollup-plugin-terser');
const options = require('minimist')(process.argv.slice(2), {
	default: {
		'web-ext': false,
		mode: 'dev',
		watch: false
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
	/*icons: {
        48: "icons/48.png",
        96: "icons/96.png",
        128: "icons/128.png"
    },*/
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
console.log(`SyncDex ${mainManifest.version} :: mode: ${options.mode} | web-ext: ${options.webExt} | watch: ${options.watch}`);

// Compile and Build
let bundleList = [{
	name: 'Core',
	input: 'src/index.ts',
	output: 'build/SyncDex.js',
}, {
	name: 'Background',
	input: 'background/index.ts',
	output: 'build/SyncDex_background.js',
}, {
	name: 'Options',
	input: 'options/index.ts',
	output: 'build/SyncDex_options.js',
}, {
	name: 'External',
	input: 'external/Anilist.ts',
	output: 'build/SyncDex_Anilist.js',
}];
const bundles = bundleList.map(bundle => {
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
			sourcemap: true,
		}
	};
});
function bundleName(outputFile) {
	const file = /.+\\(.+)$/.exec(outputFile)[1];
	return bundleList.find(bundle => {
		return bundle.output.indexOf(file) >= 0;
	}).name;
}

// Start
(async () => {
	// Compile modules
	const watcher = rollup.watch(bundles);
	let doneInitial = false;
	let duration = 0;
	watcher.on('event', async event => {
		// event.code can be one of:
		//   START        — the watcher is (re)starting
		//   BUNDLE_START — building an individual bundle
		//   BUNDLE_END   — finished building a bundle
		//   END          — finished building all bundles
		//   ERROR        — encountered an error while bundling
		if (event.code == 'BUNDLE_START') {
			console.log(`~ Compiling ${bundleName(event.output[0])}`);
		} else if (event.code == 'BUNDLE_END') {
			console.log(`> Compiled ${bundleName(event.output[0])} in ${event.duration}ms`);
			duration += event.duration;
		} else if (event.code == 'END') {
			console.log(`> Compiled all modules in ${duration}ms`);
			console.log(`~ Building extension`);
			// Build for each browsers
			for (const browser of browsers) {
				await buildExtension(browser);
			}
			duration = 0;
			console.log('Done');
			if (!doneInitial) {
				if (!options.watch) {
					watcher.close();
				} else console.log(`~ Watching folders (CTRL + C to exit)`);
				doneInitial = true;
			}
		}
	});
})();

// Create manifest, move files and build web-ext for a single Browser
async function buildExtension(browser) {
	const p = `${browser.substring(0, 1).toLocaleUpperCase()} # `; // Browser Prefix
	const log = (...message) => {
		console.log(`${p}${message}`);
	};
	// Create temp folder for the bundle
	log(`Creating tmp directory for ${browser}`);
	let folderName = `build/${browser}`;
	if (fs.existsSync(folderName)) {
		rimraf.sync(folderName);
	}
	fs.mkdirSync(folderName);

	// Merge manifests
	log(`Building Manifest version ${mainManifest.version}`);
	let manifest = Object.assign({}, mainManifest, browser_manifests[browser]);
	// Write in file
	let bundleManifestStream = fs.createWriteStream(`${folderName}/manifest.json`, {
		flags: 'w+',
	});
	bundleManifestStream.write(JSON.stringify(manifest));
	bundleManifestStream.cork();
	bundleManifestStream.end();

	log(`Copying files...`);
	const files = [
		'dist:dist',
		'icons:icons',
		'src/SyncDex.css',
		'background:background',
		'build/SyncDex_background.js:background',
		'build/SyncDex_background.js.map:background',
		'options:options',
		'build/SyncDex_options.js:options',
		'build/SyncDex_options.js.map:options',
		'build/SyncDex.js',
		'build/SyncDex.js.map',
		'build/SyncDex_Anilist.js:external',
		'build/SyncDex_Anilist.js.map:external',
	];
	if (options.mode == 'dev') {
		files.unshift('src:src');
	}
	deepFileCopy(files, folderName, ['chrome', 'firefox']);

	// Make web-ext
	if (options.webExt) {
		log(`Building with web-ext`);
		const execResult = await execPromise(
			exec(`web-ext build --source-dir ${folderName} --artifacts-dir web-ext-artifacts`)
		)
			.then(() => {
				log(`> Moving zip archive`);
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
			log(`Exit with error`);
			return;
		}
	}
	log(`Done ${browser}`);
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
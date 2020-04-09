#!/usr/bin/env node
const fs = require('fs');
const { exec, execSync } = require('child_process');
const rimraf = require('rimraf');
const path = require('path');
const options = require('minimist')(process.argv.slice(2), {
	default: {
		'web-ext': false,
		mode: 'dev',
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
				'https://anilist.co/api/v2/oauth/pin?for=syncdex*',
			],
			js: ['dist/simpleNotification.min.js', 'SyncDex.js'],
			css: ['dist/simpleNotification.min.css', 'SyncDex.css'],
		},
	],
};
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

// Build
let browsers = ['firefox', 'chrome'];
let compiled = false;
(async () => {
	for (let index = 0; index < browsers.length; index++) {
		const browser = browsers[index];

		// Create temp folder for the bundle
		console.log(`Creating tmp directory for ${browser}`);
		let folderName = `build/${browser}`;
		if (fs.existsSync(folderName)) {
			rimraf.sync(folderName);
		}
		fs.mkdirSync(folderName);

		// Merge manifests
		console.log(`Building Manifest version ${mainManifest.version}`);
		let manifest = Object.assign({}, mainManifest, browser_manifests[browser]);
		// Write in file
		let bundleManifestStream = fs.createWriteStream(`${folderName}/manifest.json`, {
			flags: 'w+',
		});
		bundleManifestStream.write(JSON.stringify(manifest));
		bundleManifestStream.cork();
		bundleManifestStream.end();

		// Compile extension
		if (!compiled) {
			console.log('Compiling...');
			execSync(`rollup -c rollup.config.js --sourcemap --environment mode:${options.mode}`);
			compiled = true;
		}

		// Copy files
		console.log('Copying files...');
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
		];
		if (options.mode == 'dev') {
			files.unshift('src:src');
		}
		deepFileCopy(files, folderName, ['chrome', 'firefox']);

		// Make web-ext
		if (options.webExt) {
			console.log('Building with web-ext');
			const execResult = await execPromise(
				exec(`web-ext build --source-dir ${folderName} --artifacts-dir web-ext-artifacts`)
			)
				.then(() => {
					console.log('> Moving zip archive');
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
				console.log('Exit with error');
				return;
			}
		}
		console.log(`Done ${browser}`);
	}
	console.log('Done');
})();

// Promisify exec -- see https://stackoverflow.com/a/30883005
function execPromise(child) {
	return new Promise((resolve, reject) => {
		child.addListener('error', reject);
		child.addListener('exit', resolve);
	});
}

// Copy files to another folder
function deepFileCopy(bases, destination, ignore = []) {
	if (!Array.isArray(bases)) bases = [bases];
	if (!fs.existsSync(destination)) {
		fs.mkdirSync(destination);
	}
	for (let index = 0; index < bases.length; index++) {
		const parts = bases[index].split(':');
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

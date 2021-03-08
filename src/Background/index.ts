import { browser, Runtime as BrowserRuntime, WebRequest } from 'webextension-polyfill-ts';
import { loadLogs, log } from '../Core/Log';
import { DefaultOptions, Options } from '../Core/Options';
import { Storage } from '../Core/Storage';
import { Updates } from '../Core/Updates';
import { Http } from '../Core/Http';
import { Cache } from './Cache';
import { Message } from '../Core/Message';
import { isChrome } from './Utility';
import { ManageSaveSync } from './SaveSync';
import { SaveSync } from '../Core/SaveSync';
import { ImportExport } from './ImportExport';

console.log('SyncDex :: Background');

// Update Message sender to send messages to the background script itself
Message.sender = <K extends keyof MessageDescriptions>(message: MessagePayload<K>): Promise<MessageResponse<K>> =>
	handleMessage(message as any);

// TODO: Handle containers in checkOnStartup since there is no sender
// Probably gate which containers to update based on the future containers update with state for each containers
// and import lists for each containers that need it by sending a fake MessageSender with preloaded tab informations for the container
function handleMessage(message: AnyMessagePayload, sender?: BrowserRuntime.MessageSender): Promise<any> {
	if (message.action == 'request') {
		return Http.sendRequest(message, sender?.tab);
	} else if (message.action == 'storage:get') {
		return Cache.get(message.key);
	} else if (message.action == 'storage:usage') {
		return Cache.usage(message.key);
	} else if (message.action == 'storage:set') {
		return Cache.set(message.values);
	} else if (message.action == 'storage:remove') {
		return Cache.remove(message.key);
	} else if (message.action == 'storage:clear') {
		return Cache.clear();
	} else if (message.action == 'openOptions') {
		return browser.runtime.openOptionsPage();
	} else if (message.action == 'import:start') {
		return ImportExport.silentImport(true);
	} else if (message.action == 'saveSync:start') {
		return ManageSaveSync.start(message.delay);
	} else if (message.action == 'saveSync:logout') {
		return ManageSaveSync.logout();
	}
	return Promise.resolve(true);
}
browser.runtime.onMessage.addListener(handleMessage);

// Toolbar clickable button
browser.browserAction.onClicked.addListener(() => {
	browser.runtime.openOptionsPage();
});

// Intercept with browser.webRequest.onBeforeSendHeaders to send Containers Cookies (Firefox)
if (!isChrome) {
	function setContainersCookies(
		details?: WebRequest.OnBeforeSendHeadersDetailsType
	): WebRequest.BlockingResponseOrPromise | void {
		if (!details || !details.originUrl || !details.requestHeaders) return;

		// Only update requests sent by MyMangaDex
		if (details.originUrl.indexOf('moz-extension://') < 0) {
			return { requestHeaders: details.requestHeaders };
		}

		// Replace Cookie headers by X-Cookie value
		const headers: WebRequest.HttpHeaders = [];
		for (const header of details.requestHeaders) {
			const headerName = header.name.toLowerCase();
			const needRewrite = headerName.indexOf('x-') === 0 && headerName != 'x-requested-with';
			if (needRewrite) {
				headers.push({
					name: headerName.slice(2),
					value: header.value,
				});
			} else if (!needRewrite /* Somehow needed ? */) {
				headers.push(header);
			}
		}
		return { requestHeaders: headers };
	}

	// Add listener on all URLs that uses Cookies
	browser.webRequest.onBeforeSendHeaders.addListener(
		setContainersCookies,
		{
			urls: [
				'https://myanimelist.net/*',
				'https://mangadex.org/*',
				'https://*.mangaupdates.com/*',
				'https://*.anime-planet.com/*',
			],
		},
		['blocking', 'requestHeaders']
	);
}

// Open options on install or on update if silentUpdate is disabled
browser.runtime.onInstalled.addListener(async (details: BrowserRuntime.OnInstalledDetailsType) => {
	if (!isChrome) browser.browserAction.setBadgeTextColor({ color: '#FFFFFF' });

	// Apply each needed Updates
	let updated = false;
	if (details.reason === 'update') {
		await Options.load();
		await loadLogs(true);
		updated = await Updates.apply();
	} else await log(`Installation version ${DefaultOptions.version}.${DefaultOptions.subVersion}`);

	// Open the options with a Modal
	if ((updated && !Options.silentUpdate) || details.reason === 'install') {
		browser.tabs.create({ url: browser.runtime.getURL(`options/index.html#${details.reason}`) });
	}
});

// Alarms (setTimeout) to trigger Save Sync if it's enabled
browser.alarms.onAlarm.addListener(ManageSaveSync.listener);

// Load everything needed on startup
// 	Also attempt to clean remaining state in storage
//	Apply Updates to fix version number on bad install/update
//	Directly trigger Save Sync and (silent) Import if they're enabled
browser.runtime.onStartup.addListener(async function () {
	if (!isChrome) browser.browserAction.setBadgeTextColor({ color: '#FFFFFF' });
	await Storage.remove(['dropboxState', 'googleDriveState', 'saveSyncInProgress', 'importInProgress']);

	await Options.load();
	await Updates.apply();
	SaveSync.state = await Storage.get('saveSync');
	await ManageSaveSync.sync();
	await ImportExport.silentImport();
});

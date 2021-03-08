import { Alarms, browser, Runtime as BrowserRuntime, WebRequest } from 'webextension-polyfill-ts';
import { loadLogs, log } from '../Core/Log';
import { ModuleStatus } from '../Core/Module';
import { DefaultOptions, Options } from '../Core/Options';
import { SaveSync } from '../Core/SaveSync';
import { SaveSyncServices } from '../SaveSync/Map';
import { Services } from '../Service/Class/Map';
import { Storage } from '../Core/Storage';
import { createModule } from '../Service/ImportExport/Utility';
import { Updates } from '../Core/Updates';
import { Http } from '../Core/Http';
import { Cache } from './Cache';
import { Message } from '../Core/Message';

console.log('SyncDex :: Background');

/// @ts-ignore
const isChrome = window.chrome && window.browser === undefined;
const SaveSyncAlarmName = 'saveSyncBackup';

// Message.sender = (message: MessagePayload) => handleMessage(message);

function setIcon(title: string = '', bgColor: string = '', text: string = '') {
	if (!isChrome) {
		browser.browserAction.setTitle({ title: title });
		browser.browserAction.setBadgeBackgroundColor({ color: bgColor == '' ? null : bgColor });
		browser.browserAction.setBadgeText({ text: text });
	}
}

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
		return silentImport(true);
	} else if (message.action == 'saveSync:start') {
		return new Promise(async (resolve) => {
			const alarm = await browser.alarms.get(SaveSyncAlarmName);
			const delay = message.delay !== undefined ? message.delay : 1;
			if (delay === 0) {
				if (alarm) {
					browser.alarms.clear(SaveSyncAlarmName);
					setIcon();
				}
				await syncSave();
			} else if (!alarm) {
				const scheduled = new Date(Date.now() + delay * 60 * 1000);
				setIcon(
					`Save will Sync in less than ${delay}minute${delay > 1 ? 's' : ''} (${scheduled.toLocaleString()})`,
					'#45A1FF',
					`${delay}m`
				);
				browser.alarms.create(SaveSyncAlarmName, { delayInMinutes: delay });
			}
			resolve(true);
		});
	} else if (message.action == 'saveSync:logout') {
		setIcon();
		browser.alarms.get(SaveSyncAlarmName).then((alarm) => {
			if (alarm) browser.alarms.clear(SaveSyncAlarmName);
		});
	}
	return Promise.resolve(true);
}
browser.runtime.onMessage.addListener(handleMessage);

browser.browserAction.onClicked.addListener(() => {
	browser.runtime.openOptionsPage();
});

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

browser.alarms.onAlarm.addListener(async (alarm: Alarms.Alarm) => {
	if (alarm.name == SaveSyncAlarmName) {
		await syncSave(true);
	}
});

async function syncSave(force: boolean = false) {
	await loadLogs(true);

	setIcon('Save Sync in progress', '#45A1FF', '...');
	const syncState = await Storage.get('saveSync');
	if (syncState !== undefined) {
		if (!(await Storage.get(StorageUniqueKey.SaveSyncInProgress, false))) {
			const saveSyncServiceClass = SaveSyncServices[syncState.service];
			if (saveSyncServiceClass !== undefined) {
				await loadLogs(true);
				await Storage.set(StorageUniqueKey.SaveSyncInProgress, true);
				let status = SaveSyncResult.ERROR;
				try {
					await Message.send('saveSync:event:start');
					// await browser.runtime.sendMessage({ action: MessageAction.saveSyncStart }).catch((_e) => _e);
					/// @ts-ignore saveSyncServiceClass is *NOT* abstract
					const saveSyncService: SaveSync = new saveSyncServiceClass();
					SaveSync.state = syncState;
					status = await saveSyncService.sync(force);
					if (status == SaveSyncResult.NOTHING) {
						await log(`Save already synced with ${syncState.service}`);
					} else if (status == SaveSyncResult.ERROR) {
						await log(`Couldn't sync your local save with ${syncState.service}`);
					} else if (status != SaveSyncResult.SYNCED) {
						await log(`Synced your save with ${syncState.service}`);
					}
				} catch (error) {
					log(error);
				}
				await Storage.remove(StorageUniqueKey.SaveSyncInProgress);
				await Message.send('saveSync:event:finish', { status });
				/*await browser.runtime
					.sendMessage({ action: MessageAction.saveSyncComplete, status: result })
					.catch((_e) => _e);*/
				setIcon('SyncDex', '#058b00', '\u2713');
			} else {
				SaveSync.state = undefined;
				delete (syncState as any).token;
				delete (syncState as any).refresh;
				await log(`Invalid Save Sync Service [${syncState}]`);
				await Storage.remove('saveSync');
				setIcon();
			}
		} else setIcon();
	} else setIcon();
}
async function silentImport(manual: boolean = false) {
	await Options.load();
	await loadLogs(true);

	if (manual || (Options.checkOnStartup && Options.services.length > 0)) {
		const checkCooldown = Options.checkOnStartupCooldown * 60 * 1000;
		const lastCheck: number | string[] = await Storage.get('import', 0);
		if (manual || typeof lastCheck !== 'number' || Date.now() - lastCheck > checkCooldown) {
			await Storage.set(StorageUniqueKey.ImportInProgress, true);
			await Message.send('import:event:start');
			// await browser.runtime.sendMessage({ action: MessageAction.importStart }).catch((_e) => _e);
			await log('Importing lists');
			const services =
				!manual && Options.checkOnStartupMainOnly ? [Options.services[0]] : [...Options.services].reverse();
			const done: string[] = typeof lastCheck === 'object' ? lastCheck : [];
			for (const key of services) {
				if (done.indexOf(key) < 0) {
					try {
						const start = Date.now();
						await log(`Importing ${Services[key].name}`);
						const module = createModule(key, 'import');
						if (!module) continue;
						const moduleResult = await module.run();
						if (moduleResult == ModuleStatus.SUCCESS) {
							await log(`Imported ${Services[key].name} in ${Date.now() - start}ms`);
						} else await log(`Could not import ${Services[key].name} | Status: ${moduleResult}`);
					} catch (error) {
						await log(`Error while importing ${Services[key].name} ${error.stack}`);
					}
					done.push(key);
					if (!manual) await Storage.set(StorageUniqueKey.Import, done);
				} else await log(`Skipping ${Services[key].name} already imported`);
			}
			if (!manual) await Storage.set(StorageUniqueKey.Import, Date.now());
			await Storage.remove(StorageUniqueKey.ImportInProgress);
			await Message.send('import:event:finish');
			// await browser.runtime.sendMessage({ action: MessageAction.importComplete }).catch((_e) => _e);
			await log(`Done Importing lists`);
		} else await log(`Startup script executed less than ${Options.checkOnStartupCooldown}minutes ago, skipping`);
	} else if (Options.checkOnStartup) await log('Did not Import: No services enabled');
}
async function onStartup() {
	if (!isChrome) browser.browserAction.setBadgeTextColor({ color: '#FFFFFF' });
	await Storage.remove(['dropboxState', 'googleDriveState', 'saveSyncInProgress', 'importInProgress']);

	await Options.load();
	await Updates.apply();
	await syncSave();
	await silentImport();
}
browser.runtime.onStartup.addListener(onStartup);

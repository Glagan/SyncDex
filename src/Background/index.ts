import { Alarms, browser, Runtime as BrowserRuntime, WebRequest } from 'webextension-polyfill-ts';
import { isChrome } from '../Core/IsChrome';
import { loadLogs, log } from '../Core/Log';
import { ModuleStatus } from '../Core/Module';
import { DefaultOptions, LogLevel, Options } from '../Core/Options';
import { Runtime } from '../Core/Runtime';
import { SaveSync } from '../Core/SaveSync';
import { SaveSyncServices } from '../SaveSync/Map';
import { Services } from '../Service/Class/Map';
import { Storage } from '../Core/Storage';
import { createModule } from '../Service/ImportExport/Utility';

console.log('SyncDex :: Background');

const SaveSyncAlarmName = 'saveSyncBackup';

function setIcon(title: string = '', bgColor: string = '', text: string = '') {
	if (!isChrome) {
		browser.browserAction.setTitle({ title: title });
		browser.browserAction.setBadgeBackgroundColor({ color: bgColor == '' ? null : bgColor });
		browser.browserAction.setBadgeText({ text: text });
	}
}

Runtime.messageSender = (message: Message) => handleMessage(message);

async function getCleanSave() {
	const save = await Storage.get();
	if (save.options?.tokens) save.options.tokens = {};
	delete save.dropboxState;
	delete save.googleDriveState;
	delete save.saveSync;
	delete save.saveSyncInProgress;
	delete save.importInProgress;
	delete save.logs;
	return save;
}

function findDomain(url: string): string {
	// Simple domain search - not the best but simple
	const res = /https?:\/\/(?:.+\.)?([-\w\d]+\.(?:\w{2,5}))(?:$|\/)/i.exec(url);
	if (res !== null) {
		return res[1];
	}
	return '*';
}
let nextRequest: Record<string, number> = {};
// Defaults to 1000ms
const DEFAULT_COOLDOWN = 1250;
const cooldowns: Record<string, number> = {
	'mangadex.org': 1500,
	'myanimelist.net': 1500,
	'nikurasu.org': 500,
};
// TODO: Handle containers in checkOnStartup since there is no sender
// Probably gate which containers to update based on the future containers update with state for each containers
// and import lists for each containers that need it by sending a fake MessageSender with preloaded tab informations for the container
function handleMessage(message: Message, sender?: BrowserRuntime.MessageSender) {
	if (message.action == MessageAction.request) {
		return new Promise(async (resolve) => {
			const msg = message as RequestMessage;
			// Cooldown
			const domain = findDomain(msg.url);
			const now = Date.now();
			// Sleep until cooldown is reached
			if (nextRequest[domain] && nextRequest[domain] >= now) {
				const diff = nextRequest[domain] - now;
				nextRequest[domain] = now + diff + (cooldowns[domain] ?? DEFAULT_COOLDOWN) + 100;
				await new Promise((resolve) => setTimeout(resolve, diff));
			} else nextRequest[domain] = now + (cooldowns[domain] ?? DEFAULT_COOLDOWN) + 100;
			// Options
			msg.isJson = msg.isJson !== undefined ? msg.isJson : false;
			msg.method = msg.method !== undefined ? msg.method : 'GET';
			msg.body = msg.body !== undefined ? msg.body : null;
			msg.redirect = msg.redirect !== undefined ? msg.redirect : 'follow';
			msg.cache = msg.cache !== undefined ? msg.cache : 'default';
			msg.mode = msg.mode !== undefined ? msg.mode : undefined;
			msg.credentials = msg.credentials !== undefined ? msg.credentials : 'same-origin';
			msg.headers = msg.headers !== undefined ? (msg.headers as Record<string, string>) : {};
			let body: File | FormData | string | undefined;
			if (msg.fileRequest !== undefined) {
				const save = await getCleanSave();
				if (msg.fileRequest == 'namedLocalSave') {
					if (msg.headers['Content-Type']) delete msg.headers['Content-Type'];
					body = new FormData();
					body.append(
						'Metadata',
						new File(
							[
								JSON.stringify({
									name: 'Save.json',
									mimeType: 'application/json',
									parents: ['appDataFolder'],
									modifiedTime: new Date().toISOString(),
								}),
							],
							'Metadata.json',
							{ type: 'application/json; charset=UTF-8' }
						)
					);
					body.append('Media', new File([JSON.stringify(save)], 'Save.json', { type: 'application/json' }));
				} else {
					if (msg.headers['Content-Type'] === undefined) {
						msg.headers['Content-Type'] = 'application/octet-stream';
					}
					body = new File([JSON.stringify(save)], 'application/json');
					//msg.headers['Content-Length'] = `${body.size}`;
				}
			} else if (msg.form !== undefined) {
				if (!(msg.form instanceof FormData)) {
					body = new FormData();
					for (const key in msg.form as FormDataProxy) {
						if (msg.form.hasOwnProperty(key)) {
							const element = msg.form[key];
							if (typeof element === 'string') {
								body.set(key, element);
							} else if (typeof element === 'number') {
								body.set(key, element.toString());
							} else {
								body.set(key, new File(element.content, element.name, element.options));
							}
						}
					}
				} else body = msg.form;
			} else if (msg.body !== null) {
				body = msg.body;
			}
			// Fetch
			if (
				sender &&
				((!isChrome && msg.credentials == 'same-origin') ||
					(msg.credentials == 'include' && sender.tab?.cookieStoreId !== undefined))
			) {
				const cookieStoreId = sender.tab!.cookieStoreId;
				const cookiesList = await browser.cookies.getAll({ url: message.url, storeId: cookieStoreId });
				const cookies = cookiesList.map((c) => `${c.name}=${c.value}`).join('; ');
				if (cookies != '') msg.headers['X-Cookie'] = cookies;
			}
			// Add Sec- Headers
			/*for (const header of ['Sec-Fetch-Dest', 'Sec-Fetch-Mode', 'Sec-Fetch-Site', 'Sec-Fetch-User']) {
				if (msg.headers[header] !== undefined) {
					msg.headers[`X-${header}`] = msg.headers[header];
				}
			}*/
			const result = await fetch(msg.url, {
				...message,
				body,
			})
				.then(async (response) => {
					return <RequestResponse>{
						url: response.url,
						ok: response.status >= 200 && response.status < 400,
						failed: false,
						code: response.status,
						redirected: response.redirected,
						// chrome doesn't allow message with the Headers object
						headers: JSON.parse(JSON.stringify(response.headers)),
						body: msg.isJson ? await response.json() : await response.text(),
					};
				})
				.catch((error) => {
					log(`Error on request [${msg.url}]: ${error}${error.stack ? `>> ${error.stack}` : ''}`);
					return <RequestResponse>{
						url: msg.url,
						ok: false,
						failed: true,
						code: 0,
						redirected: false,
						headers: {},
						body: msg.isJson ? {} : '',
					};
				});
			resolve(result);
		});
	} else if (message.action == MessageAction.openOptions) {
		return browser.runtime.openOptionsPage();
	} else if (message.action == MessageAction.silentImport) {
		return silentImport(true);
	} else if (message.action == MessageAction.saveSync) {
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
	} else if (message.action == MessageAction.saveSyncLogout) {
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
		const rewrite = ['x-cookie'];
		const headers: WebRequest.HttpHeaders = [];
		let i = -1;
		for (const header of details.requestHeaders) {
			const headerName = header.name.toLowerCase();
			if ((i = rewrite.indexOf(headerName)) >= 0) {
				headers.push({
					name: rewrite[i].slice(2),
					value: header.value,
				});
			} else headers.push(header);
		}
		return { requestHeaders: headers };
	}

	// Add listener on all URLs that uses Cookies
	browser.webRequest.onBeforeSendHeaders.addListener(
		setContainersCookies,
		{
			urls: [
				'https://myanimelist.net/about.php',
				'https://myanimelist.net/manga/*',
				'https://myanimelist.net/ownlist/manga/*',
				'https://myanimelist.net/mangalist/*',
				'https://mangadex.org/*',
				'https://*.mangaupdates.com/series.html?id=*',
				'https://*.mangaupdates.com/ajax/*',
				'https://*.anime-planet.com/manga/*',
				'https://*.anime-planet.com/api/*',
			],
		},
		['blocking', 'requestHeaders']
	);
}

interface Update {
	version: number;
	subVersion: number;
	fnct: () => void;
}
const updates: Update[] = [
	{
		version: 0.2,
		subVersion: 0.1,
		fnct: () => (Options.logLevel = LogLevel.Default),
	},
];

browser.runtime.onInstalled.addListener(async (details: BrowserRuntime.OnInstalledDetailsType) => {
	if (!isChrome) browser.browserAction.setBadgeTextColor({ color: '#FFFFFF' });

	// Apply each needed Updates
	let updated = false;
	if (details.reason === 'update') {
		await Options.load();
		const version = `${DefaultOptions.version}.${DefaultOptions.subVersion}`;
		const currentVersion = `${Options.version}.${Options.subVersion}`;
		if (version != currentVersion) {
			await log(`Updating from version ${currentVersion} to ${version}`);
			for (const update of updates) {
				if (
					update.version > Options.version ||
					(update.version == Options.version && update.subVersion > Options.subVersion)
				) {
					update.fnct();
					Options.version = update.version;
					Options.subVersion = update.subVersion;
					await log(`Applied patch version ${update.version}.${update.subVersion}`);
				}
			}
			Options.version = DefaultOptions.version;
			Options.subVersion = DefaultOptions.subVersion;
			await Options.save();
			updated = true;
		}
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
	setIcon('Save Sync in progress', '#45A1FF', '...');
	const syncState = await Storage.get('saveSync');
	if (syncState !== undefined) {
		if (!(await Storage.get(StorageUniqueKey.SaveSyncInProgress, false))) {
			const saveSyncServiceClass = SaveSyncServices[syncState.service];
			if (saveSyncServiceClass !== undefined) {
				await loadLogs(true);
				await Storage.set(StorageUniqueKey.SaveSyncInProgress, true);
				let result = SaveSyncResult.ERROR;
				try {
					await browser.runtime.sendMessage({ action: MessageAction.saveSyncStart }).catch((_e) => _e);
					/// @ts-ignore saveSyncServiceClass is *NOT* abstract
					const saveSyncService: SaveSync = new saveSyncServiceClass();
					SaveSync.state = syncState;
					result = await saveSyncService.sync(force);
					if (result == SaveSyncResult.NOTHING) {
						await log(`Save already synced with ${syncState.service}`);
					} else if (result == SaveSyncResult.ERROR) {
						await log(`Couldn't sync your local save with ${syncState.service}`);
					} else if (result != SaveSyncResult.SYNCED) {
						await log(`Synced your save with ${syncState.service}`);
					}
				} catch (error) {
					log(error);
				}
				await Storage.remove(StorageUniqueKey.SaveSyncInProgress);
				await browser.runtime
					.sendMessage({ action: MessageAction.saveSyncComplete, status: result })
					.catch((_e) => _e);
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
	if (manual || (Options.checkOnStartup && Options.services.length > 0)) {
		const checkCooldown = Options.checkOnStartupCooldown * 60 * 1000;
		const lastCheck: number | string[] = await Storage.get('import', 0);
		if (manual || typeof lastCheck !== 'number' || Date.now() - lastCheck > checkCooldown) {
			await Storage.set(StorageUniqueKey.ImportInProgress, true);
			await browser.runtime.sendMessage({ action: MessageAction.importStart }).catch((_e) => _e);
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
			await browser.runtime.sendMessage({ action: MessageAction.importComplete }).catch((_e) => _e);
			await log(`Done Importing lists`);
		} else await log(`Startup script executed less than ${Options.checkOnStartupCooldown}minutes ago, skipping`);
	} else if (Options.checkOnStartup) await log('Did not Import: No services enabled');
}
async function onStartup() {
	if (!isChrome) browser.browserAction.setBadgeTextColor({ color: '#FFFFFF' });
	await Storage.remove(['dropboxState', 'googleDriveState', 'saveSyncInProgress', 'importInProgress']);

	await syncSave();
	await silentImport();
}
browser.runtime.onStartup.addListener(onStartup);

import { Alarms, browser, Runtime as BrowserRuntime, WebRequest } from 'webextension-polyfill-ts';
import { isChrome } from '../Core/IsChrome';
import { log } from '../Core/Log';
import { ModuleStatus } from '../Core/Module';
import { DefaultOptions, Options } from '../Core/Options';
import { Runtime } from '../Core/Runtime';
import { SaveSync } from '../Core/SaveSync';
import { SaveSyncServices } from '../Core/SaveSyncServices';
import { Services } from '../Core/Services';
import { LocalStorage } from '../Core/Storage';

console.log('SyncDex :: Background');

Runtime.messageSender = (message: Message) => handleMessage(message);

function findDomain(url: string): string {
	// Simple domain search - not the best but simple
	const res = /https?:\/\/(?:.+\.)?([-\w\d]+\.(?:\w{2,5})|localhost)(?:$|\/)/i.exec(url);
	if (res !== null) {
		return res[1];
	}
	return '*';
}
let nextRequest: Record<string, number> = {};
// Defaults to 1000ms
const cooldowns: Record<string, number> = {
	'mangadex.org': 1250,
	'myanimelist.net': 1500,
	localhost: 250,
};
// TODO: Handle containers in checkOnStartup since there is no sender
// Probably gate which containers to update based on the future containers update with state for each containers
// and import lists for each containers that need it by sending a fake MessageSender with preloaded tab informations for the container
async function handleMessage(message: Message, sender?: BrowserRuntime.MessageSender) {
	if (message.action == MessageAction.request) {
		const msg = message as RequestMessage;
		// Cooldown
		const domain = findDomain(msg.url);
		const now = Date.now();
		// Sleep until cooldown is reached
		if (nextRequest[domain] && nextRequest[domain] >= now) {
			const diff = nextRequest[domain] - now;
			nextRequest[domain] = now + diff + (cooldowns[domain] ?? 1000) + 100;
			await new Promise((resolve) => setTimeout(resolve, diff));
		} else {
			nextRequest[domain] = now + (cooldowns[domain] ?? 1000) + 100;
		}
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
			msg.headers['Content-Type'] = 'application/octet-stream';
			const save = await LocalStorage.getAll();
			delete save.dropboxState;
			delete save.saveSync;
			body = new File([JSON.stringify(save)], 'application/json');
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
		return fetch(msg.url, {
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
	} else if (message.action == MessageAction.openOptions) {
		return browser.runtime.openOptionsPage();
	} else if (message.action == MessageAction.silentImport) {
		return silentImport(true);
	}
	return new Promise(() => false);
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
				'localhost/*', // !
			],
		},
		['blocking', 'requestHeaders']
	);
}

interface Update {
	version: number;
	fnct: () => void;
}
const updates: Update[] = [];

browser.runtime.onInstalled.addListener(async (details: BrowserRuntime.OnInstalledDetailsType) => {
	// Apply each needed Updates
	let updated = false;
	if (details.reason === 'update') {
		await Options.load();
		if (Options.version !== DefaultOptions.version) {
			await log(`Updating from version ${Options.version} to ${DefaultOptions.version}`);
			for (const update of updates) {
				if (update.version >= Options.version) {
					update.fnct();
					Options.version = update.version;
					await log(`Applied patch version ${update.version}`);
				}
			}
			Options.version = DefaultOptions.version;
			await Options.save();
			updated = true;
		}
	} else {
		browser.alarms.create('saveSyncBackup', { periodInMinutes: 5 });
		await log(`Installation version ${DefaultOptions.version}`);
	}

	// Open the options with a Modal
	if (updated || details.reason === 'install') {
		browser.tabs.create({ url: browser.runtime.getURL(`options/index.html#${details.reason}`) });
	}
});

browser.alarms.onAlarm.addListener(async (alarm: Alarms.Alarm) => {
	await log(`Alarms goes on ${alarm.name} ~ ${alarm.periodInMinutes}min`);
	if (alarm.name == 'saveSyncBackup') {
		syncSave();
	}
});

async function syncSave() {
	try {
		const syncState = await LocalStorage.get('saveSync');
		// TODO: Add LocalStorage('saveSyncInProgress') to avoid multiple saves at the same time
		if (syncState !== undefined) {
			await log(`Sync State ${JSON.stringify(syncState)}`);
			const saveSyncServiceClass = SaveSyncServices[syncState.service];
			if (saveSyncServiceClass !== undefined) {
				/// @ts-ignore saveSyncServiceClass is *NOT* abstract
				const saveSyncService: SaveSync = new saveSyncServiceClass();
				saveSyncService.state = syncState;
				const serverModified = await saveSyncService.lastModified();
				const localModified = await LocalStorage.get('lastModified', 0);
				if (serverModified > localModified) {
					await log(`Updating local save from ${saveSyncService.constructor.name}`);
					if (await saveSyncService.import(localModified)) {
						await log(`Updated local save`);
					} else await log(`Couldn't update your local save`);
				} else {
					await log(`Updating external save on ${saveSyncService.constructor.name}`);
					if (await saveSyncService.uploadLocalSave()) {
						await log(`Updated external save`);
					} else await log(`Couldn't update the external save`);
				}
			} else {
				delete (syncState as any).token;
				delete (syncState as any).refresh;
				await log(`Invalid Save Sync Service [${syncState}]`);
				await LocalStorage.remove('saveSync');
			}
		}
	} catch (error) {
		log(error);
	}
}
async function silentImport(manual: boolean = false) {
	await Options.load();
	if (manual || (Options.checkOnStartup && Options.services.length > 0)) {
		const checkCooldown = Options.checkOnStartupCooldown * 60 * 1000;
		const lastCheck: number | string[] = await LocalStorage.get('import', 0);
		if (manual || typeof lastCheck !== 'number' || Date.now() - lastCheck > checkCooldown) {
			await browser.runtime.sendMessage({ action: MessageAction.importStart });
			await log('Importing lists');
			await LocalStorage.set('importInProgress', true);
			const services =
				!manual && Options.checkOnStartupMainOnly ? [Options.mainService!] : [...Options.services].reverse();
			const done: string[] = typeof lastCheck === 'object' ? lastCheck : [];
			for (const key of services) {
				if (done.indexOf(key) < 0) {
					try {
						const start = Date.now();
						await log(`Importing ${Services[key].serviceName}`);
						const module = Services[key].importModule();
						const moduleResult = await module.run();
						if (moduleResult == ModuleStatus.SUCCESS) {
							await log(`Imported ${Services[key].serviceName} in ${Date.now() - start}ms`);
						} else await log(`Could not import ${Services[key].serviceName} | Status: ${moduleResult}`);
					} catch (error) {
						await log(`Error while importing ${Services[key].serviceName} ${error.stack}`);
					}
					done.push(key);
					if (!manual) await LocalStorage.set('import', { done: done });
				} else await log(`Skipping ${Services[key].serviceName} already imported`);
			}
			if (!manual) await LocalStorage.set('import', Date.now());
			await LocalStorage.remove('importInProgress');
			await browser.runtime.sendMessage({ action: MessageAction.importComplete });
			await log(`Done Importing lists`);
		} else await log(`Startup script executed less than ${Options.checkOnStartupCooldown}minutes ago, skipping`);
	} else if (Options.checkOnStartup) await log('Did not Import: No services enabled');
}
async function onStartup() {
	browser.alarms.create('saveSyncBackup', { periodInMinutes: 5 });
	await syncSave();
	await silentImport();
}
browser.runtime.onStartup.addListener(onStartup);

import { isChrome, setBrowser } from '../Core/Browser';
import { DefaultOptions, Options } from '../Core/Options';

console.log('SyncDex :: Background');

setBrowser();

async function onStartup() {}

(async () => {
	await Options.load();
	if (Options.checkOnStartup) {
		browser.runtime.onStartup.addListener(onStartup);
	}
})();

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
	'myanimelist.net': 1333,
	localhost: 250,
};
browser.runtime.onMessage.addListener(
	async (message: Message, sender: MessageSender): Promise<RequestResponse | void> => {
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
			msg.headers = msg.headers !== undefined ? msg.headers : {};
			let body: FormData | string | undefined;
			if (typeof msg.body === 'object' && msg.body !== null) {
				let data = new FormData();
				for (const key in msg.body as FormDataProxy) {
					if (msg.body.hasOwnProperty(key)) {
						const element = (msg.body as FormDataProxy)[key] as string | number | FormDataFile;
						if (typeof element === 'string') {
							data.set(key, element);
						} else if (typeof element === 'number') {
							data.set(key, element.toString());
						} else if (typeof element === 'object') {
							data.set(key, new File(element.content, element.name, element.options));
						}
					}
				}
				body = data;
			} else if (msg.body !== null) {
				body = msg.body;
			}
			// Fetch
			if (
				(!isChrome && msg.credentials == 'same-origin') ||
				(msg.credentials == 'include' && sender?.tab?.cookieStoreId !== undefined)
			) {
				const cookieStoreId = sender!.tab!.cookieStoreId;
				const cookies = await browser.cookies.getAll({ url: message.url, storeId: cookieStoreId });
				(msg.headers as Record<string, string>)['X-Cookie'] = cookies
					.map((c) => `${c.name}=${c.value}`)
					.join('; ');
			}
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
					console.error('SyncDex :: Request Error', error);
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
		}
		return new Promise(() => false);
	}
);

browser.browserAction.onClicked.addListener(() => {
	browser.runtime.openOptionsPage();
});

if (!isChrome) {
	function setContainersCookies(details: WebRequestDetails): BlockingResponse {
		// Only update requests sent by MyMangaDex
		if (details.originUrl.indexOf('moz-extension://') < 0) {
			return { requestHeaders: details.requestHeaders };
		}
		// Replace Cookie headers by X-Cookie value
		const headers: HttpHeader[] = [];
		for (const header of details.requestHeaders) {
			const headerName = header.name.toLowerCase();
			if (headerName === 'x-cookie') {
				headers.push({
					name: 'Cookie',
					value: header.value,
				});
			} else if (headerName !== 'cookie') {
				headers.push(header);
			}
		}
		return { requestHeaders: headers };
	}

	// prettier-ignore
	browser.webRequest.onBeforeSendHeaders.addListener(setContainersCookies,
		{ urls: ['https://myanimelist.net/*'] },
		[ 'blocking', 'requestHeaders' ]
	);
}

interface Update {
	version: number;
	fnct: () => void;
}
const updates: Update[] = [];

browser.runtime.onInstalled.addListener(async (details) => {
	// Apply each needed Updates
	if (details.reason === 'update') {
		await Options.load();
		for (const update of updates) {
			if (update.version >= Options.version) {
				update.fnct();
				Options.version = update.version;
			}
		}
		Options.version = DefaultOptions.version;
		await Options.save();
	}

	// Open the options with a Modal
	if (details.reason === 'install' || details.reason === 'update') {
		browser.tabs.create({ url: chrome.runtime.getURL(`options/index.html#${details.reason}`) });
	}
});

import { setBrowser } from '../Core/Browser';

console.log('SyncDex :: Background');

setBrowser();
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
	async (message: Message): Promise<RequestResponse | void> => {
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

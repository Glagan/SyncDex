import { setBrowser } from '../src/Browser';

import { Message, MessageAction } from '../src/Runtime';

console.log('SyncDex :: Background');

setBrowser();
browser.runtime.onMessage.addListener(
	async (message: Message): Promise<any> => {
		if (message.action == MessageAction.request) {
			// Default
			message.isJson = !!message.isJson;
			message.with = message.with || 'request';
			message.method = message.method || 'GET';
			message.body = message.body || null;
			message.credentials = message.credentials || 'same-origin';
			message.headers = message.headers || {};
			// XMLHttpRequest or Fetch
			if (message.with == 'XHR') {
				let xhr = new XMLHttpRequest();
				xhr.open(message.method, message.url, true);
				const keys = Object.keys(message.headers);
				for (let index = 0; index < keys.length; index++) {
					const key = keys[index];
					xhr.setRequestHeader(name, message.headers[key]);
				}
				xhr.withCredentials = true;
				xhr.send(message.body);
				return new Promise((resolve) => {
					xhr.addEventListener('readystatechange', () => {
						if (xhr.readyState == 4) {
							let body: {} | '';
							try {
								body = message.isJson
									? JSON.parse(xhr.responseText)
									: xhr.responseText;
							} catch (error) {
								body = message.isJson ? {} : '';
							}
							return resolve({
								url: xhr.responseURL,
								status: xhr.status,
								headers: xhr.getAllResponseHeaders(),
								body: body,
							});
						}
					});
				});
			} else {
				try {
					return fetch(message.url, message).then(async (response) => {
						return {
							url: response.url,
							status: response.status,
							headers: response.headers,
							body: message.isJson ? await response.json() : await response.text(),
						};
					});
				} catch (error) {
					console.error(error);
					return {
						url: message.url,
						status: 400,
						headers: {},
						body: message.isJson ? {} : '',
					};
				}
			}
		} else if (message.action == MessageAction.openOptions) {
			return browser.runtime.openOptionsPage();
		}
		return new Promise(() => false);
	}
);

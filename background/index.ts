import { setBrowser } from '../src/Browser';

import { FetchMessage, OpenOptionsMessage, MessageAction } from '../src/Message';

console.log('SyncDex :: Background');

setBrowser();
browser.runtime.onMessage.addListener(
	async (message: FetchMessage | OpenOptionsMessage): Promise<any> => {
		if (message.action == MessageAction.fetch) {
			// Default
			message.isJson = !!message.isJson;
			message.with = message.with || 'fetch';
			message.options = message.options || {};
			message.options.method = message.options.method || 'GET';
			message.options.body = message.options.body || null;
			message.options.credentials = message.options.credentials || 'same-origin';
			message.options.headers = message.options.headers || {};
			// XMLHttpRequest or Fetch
			if (message.with == 'XHR') {
				let xhr = new XMLHttpRequest();
				xhr.open(message.options.method, message.url, true);
				const keys = Object.keys(message.options.headers);
				for (let index = 0; index < keys.length; index++) {
					const key = keys[index];
					xhr.setRequestHeader(name, message.options.headers[key]);
				}
				xhr.withCredentials = true;
				xhr.send(message.options.body);
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
					return fetch(message.url, message.options).then(async (response) => {
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
						status: 0,
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

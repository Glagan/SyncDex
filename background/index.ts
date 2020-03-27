console.log('SyncDex :: Background');

enum MessageAction {
	fetch = 'fetch',
	openOptions = 'openOptions'
}

interface FetchMessage {
	action: MessageAction.fetch;
	url: string;
	isJson?: boolean;
	with: 'XHR' | 'fetch';
	options?: {
		method?: string;
		body?: string | null;
		headers?: { [key: string]: string };
	};
}

interface OpenOptionsMessage {
	action: MessageAction.openOptions;
}

type ResponseFunction = (value: {
	url: string;
	status: number;
	headers: {};
	body: string | {};
}) => void;

chrome.runtime.onMessage.addListener(
	(
		message: FetchMessage | OpenOptionsMessage,
		_sender: any,
		sendResponse: ResponseFunction
	): Promise<any> => {
		if (message.action == MessageAction.fetch) {
			// Default
			message.isJson = !!message.isJson;
			message.with = message.with || 'fetch';
			message.options = message.options || {};
			message.options.method = message.options.method || 'GET';
			message.options.body = message.options.body || null;
			message.options.headers = message.options.headers || {};
			// XMLHttpRequest or Fetch
			if (message.with == 'XHR') {
				let xhr = new XMLHttpRequest();
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
						sendResponse({
							url: xhr.responseURL,
							status: xhr.status,
							headers: xhr.getAllResponseHeaders(),
							body: body
						});
					}
				});
				xhr.open(message.options.method, message.url, true);
				const keys = Object.keys(message.options.headers);
				for (let index = 0; index < keys.length; index++) {
					const key = keys[index];
					xhr.setRequestHeader(name, message.options.headers[key]);
				}
				xhr.withCredentials = true;
				xhr.send(message.options.body);
			} else {
				fetch(message.url, message.options)
					.then(async response => {
						return {
							url: response.url,
							status: response.status,
							headers: response.headers,
							body: message.isJson
								? await response.json()
								: await response.text()
						};
					})
					.then(response => sendResponse(response))
					.catch(error => {
						console.error(error);
						sendResponse({
							url: message.url,
							status: 0,
							headers: {},
							body: message.isJson ? {} : ''
						});
					});
			}
			return new Promise(() => true);
		} else if (message.action == MessageAction.openOptions) {
			return chrome.runtime.openOptionsPage();
		}
		return new Promise(() => false);
	}
);

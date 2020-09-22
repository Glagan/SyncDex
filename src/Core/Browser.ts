console.log('SyncDex :: Browser');

export const isChrome = window.chrome && window.browser === undefined;
// Promisify Chrome
export const setBrowser = ((): (() => void) => {
	if (isChrome) {
		window.browser = window.chrome;
		const chromeGet = chrome.storage.local.get.bind(chrome.storage.local);
		browser.storage.local.get = <T>(
			key: string[] | string | null
		): Promise<Record<string, any> | Record<string, T> | undefined> => {
			return new Promise((resolve) => chromeGet(key, resolve));
		};
		const chromeSet = chrome.storage.local.set.bind(chrome.storage.local);
		browser.storage.local.set = (data: Object): Promise<void> => {
			return new Promise((resolve) => chromeSet(data, resolve));
		};
		const chromeRemove = chrome.storage.local.remove.bind(chrome.storage.local);
		browser.storage.local.remove = (key: string): Promise<void> => {
			return new Promise((resolve) => chromeRemove(key, resolve));
		};
		const chromeClear = chrome.storage.local.clear.bind(chrome.storage.local);
		browser.storage.local.clear = (): Promise<void> => {
			return new Promise((resolve) => chromeClear(resolve));
		};
		const chromeOnMessage = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
		browser.runtime.onMessage.addListener = (
			fnct: (message: Message, sender: MessageSender) => Promise<any>
		): void => {
			chromeOnMessage(
				(
					message: Message,
					sender: MessageSender,
					sendResponse: (response?: RequestResponse | void) => void
				): true => {
					fnct(message, sender).then((response) => sendResponse(response));
					return true;
				}
			);
		};
		const chromeSendMessage = chrome.runtime.sendMessage;
		browser.runtime.sendMessage = (message: Message): Promise<any> => {
			return new Promise((resolve) => chromeSendMessage(message, resolve));
		};
	}
	return () => {};
})();

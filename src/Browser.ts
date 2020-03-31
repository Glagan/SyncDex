console.log('SyncDex :: Browser');

export const isChrome = window.chrome && window.browser === undefined;
export const setBrowser = ((): (() => void) => {
	if (isChrome) {
		window.browser = window.chrome;
		const chromeGet = chrome.storage.local.get.bind(chrome.storage.local);
		browser.storage.local.get = (key: string | null): Promise<Object | undefined> => {
			return new Promise(resolve => chromeGet(key, resolve));
		};
		const chromeSet = chrome.storage.local.set.bind(chrome.storage.local);
		browser.storage.local.set = (data: Object): Promise<any> => {
			return new Promise(resolve => chromeSet(data, resolve));
		};
		const chromeRemove = chrome.storage.local.remove.bind(chrome.storage.local);
		browser.storage.local.remove = (key: string): Promise<any> => {
			return new Promise(resolve => chromeRemove(key, resolve));
		};
		const chromeClear = chrome.storage.local.clear.bind(chrome.storage.local);
		browser.storage.local.clear = (): Promise<any> => {
			return new Promise(resolve => chromeClear(resolve));
		};
	}
	return () => {};
})();

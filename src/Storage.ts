import { browser, isChrome } from './Browser';

console.log('SyncDex :: Storage');

class LocalStorage {
	static async get<T>(key: number | string | null = null): Promise<T> {
		if (typeof key == 'number') key = key.toString();
		let result;
		if (isChrome) {
			result = new Promise(resolve =>
				browser.storage.local.get(key, resolve)
			);
		} else {
			result = browser.storage.local.get(key);
		}
		return result.then((data: { [key: string]: any }) => {
			return key == null || data == undefined ? data : data[key];
		});
	}

	static set(key: number | string, data: {}): Promise<any> {
		if (typeof key == 'number') key = key.toString();
		if (isChrome) {
			return new Promise(resolve =>
				browser.storage.local.set({ [key]: data }, resolve)
			);
		}
		return browser.storage.local.set({ [key]: data });
	}

	static async remove(key: number | string): Promise<any> {
		if (typeof key == 'number') key = key.toString();
		if (isChrome) {
			return new Promise(resolve =>
				browser.storage.local.remove(key, resolve)
			);
		}
		return browser.storage.local.remove(key);
	}

	static clear(): Promise<any> {
		if (isChrome) {
			return new Promise(resolve => browser.storage.local.clear(resolve));
		}
		return browser.storage.local.clear();
	}
}

export { LocalStorage };

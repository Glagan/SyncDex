import { isChrome } from './Browser';

console.log('SyncDex :: Storage');

export class LocalStorage {
	static async get<T>(
		key: number | string | null = null
	): Promise<T | undefined> {
		if (typeof key === 'number') key = key.toString();
		let result: Promise<{} | undefined>;
		if (isChrome) {
			const nestedKey: string | null = key; // Typescript fix...
			result = new Promise(resolve =>
				chrome.storage.local.get(nestedKey, resolve)
			);
		} else {
			result = chrome.storage.local.get(key);
		}
		return result.then((data: { [key: string]: any } | undefined) => {
			return key == null || data == undefined ? data : data[key];
		});
	}

	static set(key: number | string, data: Object): Promise<any> {
		if (typeof key == 'number') key = key.toString();
		if (isChrome) {
			return new Promise(resolve =>
				chrome.storage.local.set({ [key]: data }, resolve)
			);
		}
		return chrome.storage.local.set({ [key]: data });
	}

	static async remove(key: number | string): Promise<any> {
		if (typeof key == 'number') key = key.toString();
		if (isChrome) {
			const nestedKey: string | null = key; // Typescript fix...
			return new Promise(resolve =>
				chrome.storage.local.remove(nestedKey, resolve)
			);
		}
		return chrome.storage.local.remove(key);
	}

	static clear(): Promise<any> {
		if (isChrome) {
			return new Promise(resolve => chrome.storage.local.clear(resolve));
		}
		return chrome.storage.local.clear();
	}
}

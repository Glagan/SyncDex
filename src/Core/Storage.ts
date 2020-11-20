import { browser } from 'webextension-polyfill-ts';

console.log('SyncDex :: Storage');

export class LocalStorage {
	/**
	 * Get all objects identified by `keys`.
	 * Each keys in the returned object can be undefined if it wasn't saved.
	 * Pass nothing to retrieve all Local Storage.
	 */
	static getAll<T = Record<string, any>>(
		keys?: (number | string)[]
	): Promise<Record<string, any> | Record<string, T> | undefined> {
		return browser.storage.local.get(keys === undefined ? null : keys);
	}

	/**
	 * Get the object identified by `key` from Local Storage, or undefined.
	 * Pass nothing to retrieve all Local Storage.
	 */
	static async get<T>(key: number | string): Promise<T | undefined>;
	static async get<T>(key: number | string, empty: T): Promise<T>;
	static async get<T>(key: number | string, empty?: T): Promise<T | undefined> {
		if (typeof key === 'number') key = key.toString();
		const data = await browser.storage.local.get(key === undefined ? null : key);
		if (data[key] === undefined) return empty;
		if (key !== undefined && key !== undefined) return data[key];
		return data as T;
	}

	/**
	 * Save a raw object to Local Storage.
	 * Allow to save multiple entries at the same time.
	 */
	static raw(data: Object): Promise<void> {
		return browser.storage.local.set({ ...data, lastModified: Date.now() });
	}

	/**
	 * Save the { key: data } object in Local Storage.
	 */
	static set(key: number | string, data: any): Promise<void> {
		if (typeof key == 'number') key = key.toString();
		return browser.storage.local.set({ [key]: data, lastModified: Date.now() });
	}

	/**
	 * Remove `key` from Local Storage.
	 */
	static async remove(key: number | string): Promise<void> {
		if (typeof key == 'number') key = key.toString();
		await browser.storage.local.remove(key);
		return browser.storage.local.set({ lastModified: Date.now() });
	}

	/**
	 * Clear Local Storage.
	 */
	static async clear(): Promise<void> {
		await browser.storage.local.clear();
		return browser.storage.local.set({ lastModified: Date.now() });
	}

	static isSpecialKey = (key: string): boolean => {
		return (
			key == 'options' ||
			key == 'history' ||
			key == 'startup' ||
			key == 'logs' ||
			key == 'lastModified' ||
			key == 'importInProgress' ||
			key == 'dropboxState' ||
			key == 'saveSync'
		);
	};
}

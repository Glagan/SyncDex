import { browser } from 'webextension-polyfill-ts';

console.log('SyncDex :: Storage');

export class LocalStorage {
	/**
	 * Get all objects identified by `keys`.
	 * Each keys in the returned object can be undefined if it wasn't saved.
	 * Pass null to retrieve all Local Storage.
	 */
	static getAll<T = Record<string, any>>(
		keys?: number[] | string[]
	): Promise<Record<string, any> | Record<string, T> | undefined> {
		if (keys !== undefined && keys.length > 0 && typeof keys[0] === 'number') {
			keys = (keys as number[]).map((value: number): string => {
				return value.toString();
			});
		}
		return browser.storage.local.get(keys === undefined ? null : (keys as string[]));
	}

	/**
	 * Get the object identified by `key` from Local Storage, or undefined.
	 * Pass null to retrieve all Local Storage.
	 */
	static async get<T>(key?: number | string): Promise<T | undefined> {
		if (typeof key === 'number') key = key.toString();
		const data = await browser.storage.local.get(key === undefined ? null : key);
		if (key !== undefined && key !== undefined && data !== undefined) return data[key];
		return data as T;
	}

	/**
	 * Save a raw object to Local Storage.
	 * Allow to save multiple entries at the same time.
	 */
	static raw(data: Object): Promise<void> {
		return browser.storage.local.set(data);
	}

	/**
	 * Save the { key: data } object in Local Storage.
	 */
	static set(key: number | string, data: any): Promise<void> {
		if (typeof key == 'number') key = key.toString();
		return browser.storage.local.set({ [key]: data });
	}

	/**
	 * Remove `key` from Local Storage.
	 */
	static async remove(key: number | string): Promise<void> {
		if (typeof key == 'number') key = key.toString();
		return browser.storage.local.remove(key);
	}

	/**
	 * Clear Local Storage.
	 */
	static clear(): Promise<void> {
		return browser.storage.local.clear();
	}

	static isSpecialKey = (key: string): boolean => {
		return (
			key == 'options' ||
			key == 'history' ||
			key == 'startup' ||
			key == 'logs' ||
			key == 'importInProgress' ||
			key == 'dropboxState' ||
			key == 'saveSync'
		);
	};
}

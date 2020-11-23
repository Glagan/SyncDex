import { browser } from 'webextension-polyfill-ts';
import { Runtime } from './Runtime';
import { StorageTitle } from './Title';

console.log('SyncDex :: Storage');

export enum SaveSpecialKeys {
	Options = 'options',
	History = 'history',
	Logs = 'logs',
	LastModified = 'lastModified',
	Import = 'import',
	ImportProgress = 'importInProgress',
	DropboxState = 'dropboxState',
	SaveSync = 'saveSync',
}

export class LocalStorage {
	/**
	 * Get all objects identified by `keys`.
	 * Each keys in the returned object can be undefined if it wasn't saved.
	 * Pass nothing to retrieve all Local Storage.
	 */
	static getAll(): Promise<ExportedSave> {
		return browser.storage.local.get(null);
	}

	static getList(keys: Omit<number | string, keyof ExportedSave>[]): Promise<Record<string, StorageTitle>> {
		for (const index in keys) {
			if (typeof keys[index] === 'number') keys[index] = `${keys[index]}`;
		}
		return browser.storage.local.get(keys);
	}

	/**
	 * Get the object identified by `key` from Local Storage, or undefined.
	 * Pass nothing to retrieve all Local Storage.
	 */
	static async get<T extends keyof ExportedSave>(key: T): Promise<ExportedSave[T] | undefined>;
	static async get<T extends keyof ExportedSave>(
		key: T,
		empty: ExportedSave[T]
	): Promise<NonNullable<ExportedSave[T]>>;
	static async get<T extends keyof ExportedSave>(
		key: T,
		empty?: ExportedSave[T]
	): Promise<ExportedSave[T] | undefined> {
		const data = await browser.storage.local.get(typeof key === 'number' ? `${key}` : (key as string));
		if (data[key] === undefined) return empty;
		return data[key];
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
	static async set(key: number | string, data: any) {
		if (typeof key == 'number') key = key.toString();
		await browser.storage.local.set({ [key]: data, lastModified: Date.now() });
		await Runtime.sendMessage({ action: MessageAction.saveSync });
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

	static specialKeys: string[] = Object.values(SaveSpecialKeys);

	static isSpecialKey = (key: string): key is keyof typeof SaveSpecialKeys => {
		return LocalStorage.specialKeys.includes(key);
	};
}

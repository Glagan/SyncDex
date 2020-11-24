import { browser, Storage } from 'webextension-polyfill-ts';
import { Runtime } from './Runtime';
import { SaveSync } from './SaveSync';
import { StorageTitle } from './Title';

console.log('SyncDex :: Storage');

export enum SaveSpecialKeys {
	Options = 'options',
	History = 'history',
	Logs = 'logs',
	LastModified = 'lastModified',
	Import = 'import',
	ImportProgress = 'importInProgress',
	SaveSyncProgress = 'saveSyncInProgress',
	DropboxState = 'dropboxState',
	SaveSync = 'saveSync',
}

export class LocalStorage {
	/**
	 * Get all objects identified by `keys`.
	 * Each keys in the returned object can be undefined if it wasn't saved.
	 * Pass nothing to retrieve all Local Storage.
	 */
	static getAll(): Promise<ExportedSave>;
	static getAll<T extends keyof ExportedSave>(keys?: T[]): Promise<{ [K in T]: ExportedSave[K] | undefined }> {
		if (keys === undefined) {
			/// @ts-ignore
			return browser.storage.local.get(null) as Promise<ExportedSave>;
		}
		/// @ts-ignore
		return browser.storage.local.get(keys);
	}

	static getTitleList(keys: Omit<number | string, keyof ExportedSave>[]): Promise<Record<string, StorageTitle>> {
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
	static raw<T extends string>(method: 'get', data: T[]): Promise<{ [key in T]: any }>;
	static raw(method: 'set', data: Object): Promise<void>;
	static raw(method: 'get' | 'set', data: Object): Promise<{ [key: string]: any } | void> {
		if (method == 'set') {
			return browser.storage.local.set({ ...data, lastModified: Date.now() });
		}
		return browser.storage.local[method](data);
		// TODO: send *syncSave* message ?
	}

	/**
	 * Save the { key: data } object in Local Storage.
	 */
	static async set(key: number | string, data: any) {
		const isNumber = typeof key == 'number';
		if (isNumber) key = key.toString();
		await browser.storage.local.set({ [key]: data, lastModified: Date.now() });
		// Avoid updating lastModified on keys that are local only
		if (
			isNumber ||
			(key != SaveSpecialKeys.ImportProgress &&
				key != SaveSpecialKeys.SaveSyncProgress &&
				key != SaveSpecialKeys.DropboxState &&
				key != SaveSpecialKeys.SaveSync)
		) {
			await Runtime.sendMessage({ action: MessageAction.saveSync, state: SaveSync.state });
		}
	}

	/**
	 * Remove `key` from Local Storage.
	 */
	static async remove(key: number | string): Promise<void> {
		const isNumber = typeof key == 'number';
		if (isNumber) key = key.toString();
		await browser.storage.local.remove(key as string);
		// Avoid updating lastModified on keys that are local only
		if (
			isNumber ||
			(key != SaveSpecialKeys.ImportProgress &&
				key != SaveSpecialKeys.SaveSyncProgress &&
				key != SaveSpecialKeys.DropboxState &&
				key != SaveSpecialKeys.SaveSync)
		) {
			await browser.storage.local.set({ lastModified: Date.now() });
			await Runtime.sendMessage({ action: MessageAction.saveSync, state: SaveSync.state });
		}
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

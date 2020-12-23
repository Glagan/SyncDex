import { browser } from 'webextension-polyfill-ts';
import { Runtime } from './Runtime';
import { SaveSync } from './SaveSync';
import { StorageTitle } from './Title';

console.log('SyncDex :: Storage');

export enum SaveSpecialKeys {
	Options = 'options',
	History = 'history',
	Logs = 'logs',
	LastSync = 'lastSync',
	Import = 'import',
	ImportProgress = 'importInProgress',
	SaveSyncProgress = 'saveSyncInProgress',
	DropboxState = 'dropboxState',
	GoogleDriveState = 'googleDriveState',
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

	static getTitleList(keys: Omit<number | string, keyof ExportedSave>[]): Promise<Record<string, StorageTitle>> {
		const strKeys: string[] = [];
		for (const index in keys) {
			if (typeof keys[index] === 'number') strKeys.push(`${keys[index]}`);
		}
		return browser.storage.local.get(strKeys);
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
	static async raw(method: 'set', data: Object): Promise<void>;
	static async raw(method: 'get' | 'set', data: Object): Promise<{ [key: string]: any } | void> {
		if (method == 'set') {
			await browser.storage.local.set(data);
			if (SaveSync.state) return Runtime.sendMessage({ action: MessageAction.saveSync });
		}
		return browser.storage.local[method](data);
	}

	/**
	 * Save the { key: data } object in Local Storage.
	 */
	static async set(key: number | string, data: any) {
		const isNumber = typeof key == 'number';
		if (isNumber) key = key.toString();
		await browser.storage.local.set({ [key]: data });
		if (SaveSync.state && LocalStorage.isSyncableKey(key as string)) {
			await Runtime.sendMessage({ action: MessageAction.saveSync });
		}
	}

	/**
	 * Remove `key` from Local Storage.
	 */
	static async remove(key: number | string | string[]) {
		const isNumber = typeof key == 'number';
		if (isNumber) key = key.toString();
		await browser.storage.local.remove(key as string | string[]);
		if (SaveSync.state && (typeof key !== 'string' || LocalStorage.isSyncableKey(key))) {
			await Runtime.sendMessage({ action: MessageAction.saveSync });
		}
	}

	/**
	 * Clear Local Storage.
	 */
	static clear() {
		return browser.storage.local.clear();
	}

	static specialKeys: string[] = Object.values(SaveSpecialKeys);

	static isSyncableKey = (key: string): boolean => {
		return (
			key != 'saveSync' &&
			key != 'googleDriveState' &&
			key != 'dropboxState' &&
			key != 'saveSyncInProgress' &&
			key != 'importInProgress' &&
			key != 'logs'
		);
	};

	static isSpecialKey = (key: string): key is keyof typeof SaveSpecialKeys => {
		return LocalStorage.specialKeys.includes(key);
	};
}

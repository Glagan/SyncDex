import { browser } from 'webextension-polyfill-ts';
import { Message } from './Message';
import { SaveSync } from './SaveSync';

console.log('SyncDex :: Storage');

export class Storage {
	/**
	 * Get the object identified by `key` from Local Storage, or undefined.
	 * Pass nothing to retrieve all Local Storage.
	 */
	static async get(): Promise<ExportedSave>;
	static async get<T extends ExportedSave, K extends keyof T>(key: K): Promise<T[K] | undefined>;
	static async get<T extends ExportedSave, K extends keyof T>(key: K[]): Promise<Partial<{ [key in K]: T[key] }>>;
	static async get<T extends ExportedSave, K extends keyof T>(key: K, empty: T[K]): Promise<NonNullable<T[K]>>;
	static async get<T extends ExportedSave, K extends keyof T>(
		...args: any[]
	): Promise<ExportedSave | Promise<Partial<{ [key in K]: T[key] }>> | T[K] | NonNullable<T[K]> | undefined> {
		if (args.length == 0) return browser.storage.local.get();
		const key = args[0];
		const data = await browser.storage.local.get(typeof key === 'number' ? `${key}` : key);
		if (typeof key === 'object') {
			return data;
		}
		if (data[key] === undefined) return args[1] ?? undefined;
		return data[key];
	}

	static async set<T extends ExportedSave, K extends keyof T>(data: Partial<{ [key in K]: T[K] }>): Promise<void>;
	static async set<T extends ExportedSave, K extends keyof T>(key: K, data: T[K]): Promise<void>;
	static async set(...args: any[]): Promise<void> {
		if (typeof args[0] === 'object') {
			return browser.storage.local.set(args[0]);
		}
		if (SaveSync.state && Storage.isSyncableKey(args[0])) {
			await Message.send({ action: MessageAction.saveSync });
		}
		return browser.storage.local.set({ [`${args[0]}`]: args[1] });
	}

	/**
	 * Save a raw object to Local Storage.
	 * Allow to save multiple entries at the same time.
	 */
	/*static raw<T extends string>(method: 'get', data: T[]): Promise<{ [key in T]: any }>;
	static async raw(method: 'set', data: Object): Promise<void>;
	static async raw(method: 'get' | 'set', data: Object): Promise<{ [key: string]: any } | void> {
		if (method == 'set') {
			await browser.storage.local.set(data);
			if (SaveSync.state) return Runtime.sendMessage({ action: MessageAction.saveSync });
		}
		return browser.storage.local[method](data);
	}*/

	/**
	 * Remove `key` from Local Storage.
	 */
	static async remove(key: number | string | string[]) {
		const isNumber = typeof key == 'number';
		if (isNumber) key = key.toString();
		await browser.storage.local.remove(key as string | string[]);
		if (SaveSync.state && (typeof key !== 'string' || Storage.isSyncableKey(key))) {
			await Message.send({ action: MessageAction.saveSync });
		}
	}

	/**
	 * Clear Local Storage.
	 */
	static clear() {
		return browser.storage.local.clear();
	}

	static specialKeys: string[] = [
		StorageUniqueKey.Options,
		StorageUniqueKey.Import,
		StorageUniqueKey.ImportInProgress,
		StorageUniqueKey.Logs,
		StorageUniqueKey.History,
		StorageUniqueKey.GoogleDriveState,
		StorageUniqueKey.DropboxState,
		StorageUniqueKey.SaveSync,
		StorageUniqueKey.SaveSyncInProgress,
		StorageUniqueKey.LastSync,
	];

	static isSyncableKey = (key: string): boolean => {
		return (
			key != StorageUniqueKey.ImportInProgress &&
			key != StorageUniqueKey.Logs &&
			key != StorageUniqueKey.SaveSync &&
			key != StorageUniqueKey.SaveSyncInProgress &&
			key != StorageUniqueKey.LastSync &&
			key != StorageUniqueKey.DropboxState &&
			key != StorageUniqueKey.GoogleDriveState
		);
	};

	static isSpecialKey(key: string): key is keyof typeof StorageUniqueKey {
		return Storage.specialKeys.includes(key);
	}
}

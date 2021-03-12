import { browser } from 'webextension-polyfill-ts';
import { Message } from './Message';

console.log('SyncDex :: Storage');

export namespace Storage {
	/**
	 * With a single key as parameter,
	 * 	returns the value associated to the key,
	 * 	or undefined if it doesn't exists.
	 * With a list of keys as parameter,
	 * 	returns the value associated to the list of keys in an object indexed by the requested keys,
	 * 	with keys value set as undefined if it doesn't exists.
	 * @param key null for all keys or a valid key or list of keys
	 * @param defaultv Default value if the key is not found
	 */
	export async function get(): Promise<StorageValues>;
	export async function get(key: null): Promise<StorageValues>;
	export async function get<T extends StorageValues, K extends keyof T>(key: K): Promise<T[K] | undefined>;
	export async function get<T extends StorageValues, K extends keyof T>(
		key: K[]
	): Promise<Partial<{ [key in K]: T[key] }>>;
	export async function get<T extends StorageValues, K extends keyof T>(
		key: K,
		defaultv: T[K]
	): Promise<NonNullable<T[K]>>;
	export async function get<T extends StorageValues, K extends keyof T>(
		...args: any[]
	): Promise<StorageValues | Promise<Partial<{ [key in K]: T[key] }>> | T[K] | NonNullable<T[K]> | undefined> {
		const res = await Message.send('storage:get', { key: args[0] ?? null });
		// Message.send can returns null if undefined is sent on Chrome
		return res === null ? undefined : res !== undefined ? res : args[1] ?? undefined;
	}

	/**
	 * Returns the number of bytes used by the list of keys or by all keys if key is null
	 * @param key null for all keys or a valid key or list of keys
	 */
	export async function usage(): Promise<number>;
	export async function usage<T extends StorageValues, K extends keyof T>(key: K): Promise<number>;
	export async function usage<T extends StorageValues, K extends keyof T>(key: K[]): Promise<number>;
	export async function usage(...args: any[]): Promise<number> {
		return Message.send('storage:usage', { key: args[0] ?? null });
	}

	/**
	 * Update (overwrite) or insert the key with it's associated value in local storage.
	 * @param key A valid key
	 * @param data The data associated to the key
	 */
	export async function set<T extends StorageValues, K extends keyof T>(
		data: Partial<{ [key in K]: T[K] }>
	): Promise<boolean>;
	export async function set<T extends StorageValues, K extends keyof T>(key: K, data: T[K]): Promise<boolean>;
	export async function set(...args: any[]): Promise<boolean> {
		if (args.length == 2) {
			return Message.send('storage:set', {
				values: { [args[0]]: args[1] },
			});
		}
		return Message.send('storage:set', { values: args[0] });
	}

	/**
	 * Remove the key or list of keys from local storage if they exists.
	 * @param key A valid key or list of keys
	 */
	export async function remove(key: StorageUniqueKey | StorageUniqueKey[] | number | string | string[]) {
		await Message.send('storage:remove', { key });
	}

	/**
	 * Permanently delete all local storage.
	 */
	export function clear() {
		return browser.storage.local.clear();
	}

	/**
	 * Returns true if key is a key that can trigger a Save Sync.
	 * @param key The key to check
	 */
	export function isSyncableKey(key: string): boolean {
		return (
			key != StorageUniqueKey.ImportInProgress &&
			key != StorageUniqueKey.Logs &&
			key != StorageUniqueKey.SaveSync &&
			key != StorageUniqueKey.SaveSyncInProgress &&
			key != StorageUniqueKey.LastSync &&
			key != StorageUniqueKey.DropboxState &&
			key != StorageUniqueKey.GoogleDriveState
		);
	}

	const specialKeys: string[] = [
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

	/**
	 * Returns true if key is a non-Title key.
	 * @param key The key to check
	 */
	export function isSpecialKey(key: string): key is keyof typeof StorageUniqueKey {
		return specialKeys.includes(key);
	}
}

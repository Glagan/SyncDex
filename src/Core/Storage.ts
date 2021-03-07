import { browser } from 'webextension-polyfill-ts';
import { Message } from './Message';
import { SaveSync } from './SaveSync';

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
		return Message.send('storage:get', { key: args[0] ?? undefined, default: args[1] ?? undefined });
		/*if (args.length == 0) return browser.storage.local.get();
		const key = args[0];
		const data = await browser.storage.local.get(typeof key === 'number' ? `${key}` : key);
		if (typeof key === 'object') {
			return data;
		}
		if (data[key] === undefined) return args[1] ?? undefined;
		return data[key];*/
	}

	/**
	 * Returns the number of bytes used by the list of keys or by all keys if key is null
	 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1385832
	 * @param key null for all keys or a valid key or list of keys
	 */
	export async function usage(): Promise<number>;
	export async function usage<T extends StorageValues, K extends keyof T>(key: K): Promise<number>;
	export async function usage<T extends StorageValues, K extends keyof T>(key: K[]): Promise<number>;
	export async function usage(...args: any[]): Promise<number> {
		return new TextEncoder().encode(
			Object.entries(await browser.storage.local.get(args[0] ?? null))
				.map(([key, value]) => key + JSON.stringify(value))
				.join('')
		).length;
	}

	/**
	 * Update (overwrite) or insert the key with it's associated value in local storage.
	 * @param key A valid key
	 * @param data The data associated to the key
	 */
	export async function set<T extends StorageValues, K extends keyof T>(
		data: Partial<{ [key in K]: T[K] }>
	): Promise<void>;
	export async function set<T extends StorageValues, K extends keyof T>(key: K, data: T[K]): Promise<void>;
	export async function set(...args: any[]): Promise<void> {
		if (typeof args[0] === 'object') {
			return browser.storage.local.set(args[0]);
		}
		if (SaveSync.state && Storage.isSyncableKey(args[0])) {
			await Message.send({ action: MessageAction.saveSync });
		}
		return browser.storage.local.set({ [`${args[0]}`]: args[1] });
	}

	/**
	 * Remove the key or list of keys from local storage if they exists.
	 * @param key A valid key or list of keys
	 */
	export async function remove(key: number | string | string[]) {
		const isNumber = typeof key == 'number';
		if (isNumber) key = key.toString();
		await browser.storage.local.remove(key as string | string[]);
		if (SaveSync.state && (typeof key !== 'string' || Storage.isSyncableKey(key))) {
			await Message.send({ action: MessageAction.saveSync });
		}
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

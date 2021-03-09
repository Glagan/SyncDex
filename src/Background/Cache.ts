import { browser } from 'webextension-polyfill-ts';
import { SaveSync } from '../Core/SaveSync';
import { Storage } from '../Core/Storage';
import { ManageSaveSync } from './SaveSync';

export namespace Cache {
	// let cache: StorageValues = {};

	/**
	 * Remove references and assign all LocalStorage cache.
	 */
	/*export async function load() {
		cache = (await browser.storage.local.get()) as StorageValues;
	}*/

	export async function get(): Promise<StorageValues>;
	export async function get(key: null): Promise<StorageValues>;
	export async function get<T extends StorageValues, K extends keyof T>(key: K): Promise<T[K] | undefined>;
	export async function get<T extends StorageValues, K extends keyof T>(
		key: K[]
	): Promise<Partial<{ [key in K]: T[key] }>>;
	export async function get<T extends StorageValues, K extends keyof T>(
		...args: any[]
	): Promise<StorageValues | Promise<Partial<{ [key in K]: T[key] }>> | T[K] | NonNullable<T[K]> | undefined> {
		/*if (args.length == 0) return cache;
		const key = args[0];
		if (Array.isArray(key)) {
			const result = {} as any;
			for (const k of key) {
				result[k] = cache[k];
			}
			return result;
		}
		return cache[key] as any;*/
		if (args.length == 0) return browser.storage.local.get();
		const key = args[0];
		const data = await browser.storage.local.get(typeof key === 'number' ? `${key}` : key);
		if (typeof key === 'object') {
			return data;
		}
		return data[key];
	}

	/**
	 * @see https://bugzilla.mozilla.org/show_bug.cgi?id=1385832
	 */
	export function usage(): Promise<number>;
	export function usage<T extends StorageValues, K extends keyof T>(key: K): Promise<number>;
	export function usage<T extends StorageValues, K extends keyof T>(key: K[]): Promise<number>;
	export async function usage(...args: any[]): Promise<number> {
		// const save = cache;
		const save = await browser.storage.local.get(args[0] ?? null);
		return new TextEncoder().encode(
			Object.entries(save)
				.map(([key, value_1]) => key + JSON.stringify(value_1))
				.join('')
		).length;
	}

	export async function set<T extends StorageValues, K extends keyof T>(
		data: Partial<{ [key in K]: T[K] }>
	): Promise<boolean> {
		/*
		for (const key of Object.keys(args[1])) {
			cache[key] = args[1][key];
		}
		commit -> true / catch -> false
		return true;*/
		try {
			await browser.storage.local.set(data);
			if (SaveSync.state) {
				// Check if any of the keys in data is syncable
				for (const key in data) {
					if (Storage.isSyncableKey(key)) {
						ManageSaveSync.start();
						break;
					}
				}
			}
			return true;
		} catch (e) {
			return false;
		}
	}

	export async function remove(key: number | string | string[]) {
		/*if (typeof key === 'object') {
			for (const k of key) {
				delete cache[k];
			}
		} else {
			delete cache[k];
		}
		commit -> true / catch -> false
		return true;
		*/
		const isNumber = typeof key === 'number';
		if (isNumber) key = key.toString();
		try {
			await browser.storage.local.remove(key as string | string[]);
			if (SaveSync.state && (typeof key !== 'string' || Storage.isSyncableKey(key))) {
				ManageSaveSync.start();
			}
			return true;
		} catch (e) {
			return false;
		}
	}

	/**
	 * Permanently delete all local storage.
	 */
	export async function clear() {
		/*cache = {};
		commit -> true / catch -> false
		return true;
		*/
		try {
			await browser.storage.local.clear();
			return true;
		} catch (e) {
			return false;
		}
	}
}

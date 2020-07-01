console.log('SyncDex :: Storage');

export class LocalStorage {
	static getAll<T = Record<string, any>>(
		keys?: number[] | string[]
	): Promise<Record<string, any> | Record<string, T> | undefined> {
		if (keys !== undefined && keys.length > 0 && typeof keys[0] === 'number') {
			keys = (keys as number[]).map((value: number): string => {
				return value.toString();
			});
		}
		return browser.storage.local.get<T>(keys === undefined ? null : (keys as string[]));
	}

	static async get<T>(key?: number | string): Promise<any | T | undefined> {
		if (typeof key === 'number') key = key.toString();
		const data = await browser.storage.local.get<T>(key === undefined ? null : key);
		if (key !== undefined && key !== undefined && data !== undefined) return data[key];
		return data as any;
	}

	static raw(data: Object): Promise<any> {
		return browser.storage.local.set(data);
	}

	static set(key: number | string, data: Object): Promise<any> {
		if (typeof key == 'number') key = key.toString();
		return browser.storage.local.set({ [key]: data });
	}

	static async remove(key: number | string): Promise<any> {
		if (typeof key == 'number') key = key.toString();
		return browser.storage.local.remove(key);
	}

	static clear(): Promise<any> {
		return browser.storage.local.clear();
	}
}

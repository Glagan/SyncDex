console.log('SyncDex :: Storage');

export class LocalStorage {
	static getAll<T = Record<string, any>>(
		keys: number[] | string[]
	): Promise<Record<string, T> | undefined> {
		if (keys != null && keys.length > 0 && typeof keys[0] === 'number') {
			keys = (keys as number[]).map((value: number): string => {
				return value.toString();
			});
		}
		return browser.storage.local.get<T>(keys as string[]).then((data) => {
			return data;
		});
	}

	static get<T>(key: number | string): Promise<T | undefined> {
		if (typeof key === 'number') key = key.toString();
		return browser.storage.local.get<T>(key).then((data): T | undefined => {
			return key === null || data === undefined ? undefined : data[key];
		});
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

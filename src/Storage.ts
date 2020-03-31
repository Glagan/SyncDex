console.log('SyncDex :: Storage');

export class LocalStorage {
	static async get<T>(key: number | string | null = null): Promise<T | undefined> {
		if (typeof key === 'number') key = key.toString();
		return browser.storage.local.get(key).then((data: { [key: string]: any } | undefined) => {
			return key == null || data == undefined ? data : data[key];
		});
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

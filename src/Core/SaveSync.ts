import { browser } from 'webextension-polyfill-ts';
import { log } from './Log';
import { LocalStorage } from './Storage';

export abstract class SaveSync {
	static FILENAME = '/Save.json';

	static realName: string;
	static icon: () => HTMLElement;
	static state?: SaveSyncState;
	static redirectURI(service: string) {
		return `https://syncdex.nikurasu.org/?for=${service}`;
	}

	abstract createCard(): HTMLButtonElement;
	abstract onCardClick(node: HTMLButtonElement): Promise<void>;

	abstract login(query: { [key: string]: string }): Promise<SaveSyncLoginResult>;
	abstract lastSync(): Promise<number>;
	logout = async (): Promise<boolean> => {
		return true;
	};
	abstract delete(): Promise<boolean>;
	clean = async (): Promise<void> => {
		return browser.storage.local.remove('saveSync');
	};

	abstract refreshTokenIfNeeded(): Promise<boolean>;
	abstract uploadLocalSave(): Promise<number>;
	import = async (lastSync?: number): Promise<SaveSyncResult> => {
		if (await this.refreshTokenIfNeeded()) {
			if (!lastSync) {
				lastSync = await this.lastSync();
				if (lastSync < 0) return SaveSyncResult.ERROR;
			}
			const file = await this.downloadExternalSave();
			if (typeof file === 'string') {
				try {
					await browser.storage.local.set({ ...JSON.parse(file), lastSync: lastSync });
					return SaveSyncResult.DOWNLOADED;
				} catch (error) {
					await log(error);
				}
			}
		}
		return SaveSyncResult.ERROR;
	};
	abstract downloadExternalSave(): Promise<string | boolean>;
	export = async (): Promise<SaveSyncResult> => {
		if (await this.refreshTokenIfNeeded()) {
			const result = await this.uploadLocalSave();
			if (result > 0) {
				await browser.storage.local.set({ lastSync: result });
				return SaveSyncResult.UPLOADED;
			}
		}
		return SaveSyncResult.ERROR;
	};

	// Error when localSave is more recent than the external save and *should* be exported but there is no way to check.
	// lastSync is never deleted, if there is no service change it shouldn't be a problem,
	// 	the old save will have the same lastSync server side and it will export, and maybe that's enough.
	sync = async (): Promise<SaveSyncResult> => {
		const lastSync = await this.lastSync();
		if (lastSync == 0) {
			return this.export();
		} else if (lastSync > 0) {
			const localSync = await LocalStorage.get('lastSync');
			if (localSync === undefined || localSync < lastSync) {
				return this.import(lastSync);
			}
			return this.export();
		}
		return SaveSyncResult.ERROR;
	};
}

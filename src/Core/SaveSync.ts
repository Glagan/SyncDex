import { browser } from 'webextension-polyfill-ts';
import { log } from './Log';
import { LocalStorage } from './Storage';

export function Declare(serviceName: string, iconFct: () => HTMLElement) {
	return function (constructor: typeof SaveSync) {
		constructor.realName = serviceName;
		constructor.icon = iconFct;
	};
}

export abstract class SaveSync {
	static FILENAME = '/Save.json';

	static realName: string;
	static icon: () => HTMLElement;
	static state?: SaveSyncState;
	static REDIRECT_URI: string;

	get name(): string {
		return (<typeof SaveSync>this.constructor).realName;
	}

	get icon(): HTMLElement {
		return (<typeof SaveSync>this.constructor).icon();
	}

	constructor() {
		const that = <typeof SaveSync>this.constructor;
		that.REDIRECT_URI = `https://syncdex.nikurasu.org/?for=${that.name}`;
	}

	abstract createCard(): HTMLButtonElement;
	abstract onCardClick(): Promise<void>;

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
	sync = async (force: boolean = false): Promise<SaveSyncResult> => {
		const lastSync = await this.lastSync();
		if (force || lastSync == 0) {
			await log(`No external lastSync or ${force ? 'forced' : 'not forced'}, uploading save.`);
			return this.export();
		} else if (lastSync > 0) {
			const localSync = await LocalStorage.get('lastSync');
			if (localSync === undefined || localSync < lastSync) {
				await log(`No local lastSync or ${localSync} < ${lastSync}, downloading save.`);
				return this.import(lastSync);
			} else if (localSync > lastSync) {
				await log(`${localSync} > ${lastSync}, uploading save.`);
				return this.export();
			}
			return SaveSyncResult.NOTHING;
		}
		return SaveSyncResult.ERROR;
	};
}

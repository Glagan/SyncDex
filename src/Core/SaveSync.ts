import { log } from './Log';
import { Options } from './Options';
import { Storage } from './Storage';
import { Updates } from './Updates';

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

	abstract refreshTokenIfNeeded(): Promise<boolean>;
	abstract login(query: { [key: string]: string }): Promise<SaveSyncLoginResult>;
	abstract lastSync(): Promise<number>;
	logout = async (): Promise<boolean> => {
		return true;
	};
	abstract delete(): Promise<boolean>;
	clean = async (): Promise<void> => {
		return Storage.remove('saveSync');
	};

	abstract downloadExternalSave(): Promise<string | boolean>;
	import = async (lastSync?: number): Promise<SaveSyncResult> => {
		if (await this.refreshTokenIfNeeded()) {
			if (!lastSync) {
				lastSync = await this.lastSync();
				if (lastSync < 0) return SaveSyncResult.ERROR;
			}
			const file = await this.downloadExternalSave();
			if (typeof file === 'string') {
				try {
					const [services, tokens] = [Options.services, Options.tokens];
					const newSave = JSON.parse(file) as StorageValues;
					newSave.lastSync = lastSync;
					// Restore tokens if the services did not change
					const newServices = newSave?.options?.services;
					if (
						Array.isArray(newServices) &&
						newServices.length === services.length &&
						newServices.every((value) => services.indexOf(value) >= 0)
					) {
						newSave.options!.tokens = tokens;
					}
					await Storage.set(newSave);
					await Options.load();
					await Updates.apply();
					return SaveSyncResult.DOWNLOADED;
				} catch (error) {
					await log(error);
				}
			}
		}
		return SaveSyncResult.ERROR;
	};

	abstract uploadLocalSave(): Promise<number>;
	export = async (): Promise<SaveSyncResult> => {
		if (await this.refreshTokenIfNeeded()) {
			const result = await this.uploadLocalSave();
			if (result > 0) {
				await Storage.set(StorageUniqueKey.LastSync, result);
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
			await log(`${force ? 'Forced' : 'No lastSync'}, uploading save.`);
			return this.export();
		} else if (lastSync > 0) {
			const localSync = await Storage.get('lastSync');
			if (localSync === undefined || localSync < lastSync) {
				await log(`${localSync ? `${localSync} < ${lastSync}` : 'No local lastSync'}, downloading save.`);
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

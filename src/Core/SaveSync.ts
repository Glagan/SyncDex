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
		return LocalStorage.remove('saveSync');
	};

	abstract uploadLocalSave(): Promise<number>;
	abstract downloadExternalSave(): Promise<string | boolean>;

	sync = async (): Promise<SaveSyncResult> => {
		const lastSync = await this.lastSync();
		if (lastSync == 0) {
			const result = await this.uploadLocalSave();
			if (result > 0) {
				await LocalStorage.set('lastSync', result);
				return SaveSyncResult.UPLOADED;
			} else return SaveSyncResult.ERROR;
		} else if (lastSync > 0) {
			const localSync = await LocalStorage.get('lastSync');
			if (localSync === undefined || localSync < lastSync) {
				const file = await this.downloadExternalSave();
				if (typeof file === 'string') {
					try {
						await LocalStorage.raw('set', { ...JSON.parse(file), lastSync: lastSync });
						return SaveSyncResult.DOWNLOADED;
					} catch (error) {
						await log(error);
					}
				}
				return SaveSyncResult.ERROR;
			}
			const result = await this.uploadLocalSave();
			if (result > 0) {
				await LocalStorage.set('lastSync', result);
				return SaveSyncResult.UPLOADED;
			}
			return SaveSyncResult.ERROR;
		}
		return SaveSyncResult.ERROR;
	};
}

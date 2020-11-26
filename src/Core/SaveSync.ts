import { log } from './Log';
import { LocalStorage } from './Storage';

export const enum SyncResult {
	UPLOADED,
	DOWNLOADED,
	SYNCED,
	ERROR,
}

export abstract class SaveSync {
	static icon: () => HTMLElement;
	static state?: SaveSyncState;

	abstract createCard(): HTMLButtonElement;
	abstract onCardClick(node: HTMLButtonElement): Promise<void>;

	abstract login(query: { [key: string]: string }): Promise<boolean>;
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

	sync = async (): Promise<SyncResult> => {
		const lastSync = await this.lastSync();
		if (lastSync == 0) {
			const result = await this.uploadLocalSave();
			if (result > 0) {
				await LocalStorage.set('lastSync', result);
				return SyncResult.UPLOADED;
			} else return SyncResult.ERROR;
		} else if (lastSync > 0) {
			const localSync = await LocalStorage.get('lastSync');
			if (localSync === undefined || localSync < lastSync) {
				const file = await this.downloadExternalSave();
				if (typeof file === 'string') {
					try {
						await LocalStorage.raw('set', { ...JSON.parse(file), lastSync: lastSync });
						return SyncResult.DOWNLOADED;
					} catch (error) {
						await log(error);
					}
				}
				return SyncResult.ERROR;
			} else if (lastSync != localSync) {
				const result = await this.uploadLocalSave();
				if (result > 0) {
					await LocalStorage.set('lastSync', result);
					return SyncResult.UPLOADED;
				} else return SyncResult.ERROR;
			} else return SyncResult.SYNCED;
		} else {
			SimpleNotification.error({
				title: 'API Error',
				text: `Could not sync your save with ${this.constructor.name}`,
			});
		}
		return SyncResult.ERROR;
	};
}

import { log } from './Log';
import { LocalStorage } from './Storage';

export abstract class SaveSync {
	static icon: () => HTMLElement;
	state: SaveSyncState | null = null;

	abstract createCard(): HTMLButtonElement;
	abstract onCardClick(node: HTMLButtonElement): Promise<void>;

	abstract login(query: { [key: string]: string }): Promise<boolean>;
	abstract lastModified(): Promise<number>;
	logout = async (): Promise<boolean> => {
		return true;
	};
	abstract delete(): Promise<boolean>;
	clean = async (): Promise<void> => {
		return LocalStorage.remove('saveSync');
	};

	abstract downloadExternalSave(): Promise<string | boolean>;
	import = async (lastModified: number): Promise<boolean> => {
		const file = await this.downloadExternalSave();
		if (typeof file === 'string') {
			try {
				const save: ExportedSave = JSON.parse(file);
				if (!save.lastModified || save.lastModified > lastModified) {
					delete (save.options as any).tokens;
					delete save.dropboxState;
					delete save.saveSync;
					delete save.lastModified;
					delete save.importInProgress;
					if (save.import && typeof save.import !== 'number') {
						delete save.import;
					}
					//delete save.logs;
					await LocalStorage.raw(save);
				}
			} catch (error) {
				log(error);
			}
		}
		return false;
	};

	abstract uploadLocalSave(): Promise<boolean>;
}

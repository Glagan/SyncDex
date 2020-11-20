import { LocalStorage } from './Storage';

export interface SaveSyncState {
	service: string;
	token: string;
	expires: number;
	refresh: string;
}

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
}

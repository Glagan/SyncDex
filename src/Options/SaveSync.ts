import { SaveSyncManager } from './Manager/SaveSync';

export interface SaveSyncState {
	service: string;
	token: string;
	expires: number;
	refresh: string;
}

export abstract class SaveSync {
	state: SaveSyncState | null = null;

	abstract createCard(): HTMLButtonElement;
	abstract async onCardClick(node: HTMLButtonElement): Promise<void>;
	abstract manage(manager: SaveSyncManager, parent: HTMLElement): void;
	abstract async login(query: { [key: string]: string }): Promise<boolean>;
	abstract async clean(): Promise<void>;
}

import { DOM } from '../../Core/DOM';
import { LocalStorage } from '../../Core/Storage';
import { SaveSync, SaveSyncState } from '../SaveSync';
import { Dropbox } from '../SaveSync/Dropbox';

interface Query {
	[key: string]: string;
}

export class SaveSyncManager {
	saveSyncServices: { [key: string]: SaveSync } = { Dropbox: new Dropbox() };
	container: HTMLElement;
	cards: HTMLButtonElement[] = [];

	constructor() {
		this.container = document.getElementById('save-sync-container')!;
		for (const key of Object.keys(this.saveSyncServices)) {
			const syncService = this.saveSyncServices[key];
			const card = syncService.createCard();
			card.addEventListener('click', (event) => {
				event.preventDefault();
				syncService.onCardClick(card);
			});
			this.cards.push(card);
		}
		this.initialize();
	}

	initialize = async () => {
		// Check if there is a token being received for a save sync service
		const query: Query = {};
		const queryString = window.location.search.substring(1);
		queryString
			.split('&')
			.map((s) => s.split('='))
			.forEach((s) => (query[s[0]] = s[1]));
		if (query.for && query.for !== '') {
			this.container.appendChild(DOM.create('p', { textContent: 'Loading...' }));
			for (const key of Object.keys(this.saveSyncServices)) {
				const syncService = this.saveSyncServices[key];
				if (syncService.constructor.name == query.for) {
					await syncService.login(query);
					break;
				}
			}
			this.refresh();
		} else this.refresh();
	};

	refresh = async (): Promise<void> => {
		DOM.clear(this.container);
		const state = await LocalStorage.get<SaveSyncState>('saveSync');
		if (state !== undefined) {
			this.saveSyncServices[state.service].state = state;
			this.saveSyncServices[state.service].manage(this, this.container);
		} else DOM.append(this.container, ...this.cards);
	};
}

import { DOM } from '../../Core/DOM';
import { LocalStorage } from '../../Core/Storage';
import { SaveSync } from '../../Core/SaveSync';
import { Dropbox } from '../../SaveSync/Dropbox';

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
		const state = await LocalStorage.get('saveSync');
		if (state !== undefined) {
			const syncService = this.saveSyncServices[state.service];
			syncService.state = state;

			// Make summary and manage buttons
			const summary = DOM.create('p', {
				childs: [
					DOM.text('Logged in on'),
					DOM.space(),
					DOM.create('b', {
						childs: [
							(<typeof SaveSync>syncService.constructor).icon(),
							DOM.space(),
							DOM.text(syncService.constructor.name),
						],
					}),
					DOM.text('.'),
				],
			});
			const importButton = DOM.create('button', {
				class: 'primary',
				childs: [DOM.icon('cloud-download-alt'), DOM.space(), DOM.text('Import')],
			});
			const exportButton = DOM.create('button', {
				class: 'primary',
				childs: [DOM.icon('cloud-upload-alt'), DOM.space(), DOM.text('Export')],
			});
			const deleteLogout = DOM.create('button', {
				class: 'danger',
				childs: [DOM.icon('trash-alt'), DOM.space(), DOM.text('Delete and Logout')],
				events: {
					click: async (event) => {
						event.preventDefault();
						if (await syncService.delete()) {
							await syncService.logout();
							await syncService.clean();
						} else SimpleNotification.error({ text: `Could not delete your save, check logs.` });
						this.refresh();
					},
				},
			});
			const logout = DOM.create('button', {
				class: 'danger',
				childs: [DOM.icon('sign-out-alt'), DOM.space(), DOM.text('Logout')],
				events: {
					click: async (event) => {
						event.preventDefault();
						await syncService.logout();
						await syncService.clean();
						this.refresh();
					},
				},
			});
			DOM.append(
				this.container,
				summary,
				DOM.create('div', {
					class: 'manage',
					childs: [importButton, exportButton, deleteLogout, logout],
				})
			);
		} else DOM.append(this.container, ...this.cards);
	};
}

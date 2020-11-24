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
	syncService?: SaveSync;
	importButton: HTMLButtonElement;
	exportButton: HTMLButtonElement;
	deleteLogoutButton: HTMLButtonElement;
	logoutButton: HTMLButtonElement;

	constructor() {
		this.container = document.getElementById('save-sync-container')!;

		// Logged out nodes
		for (const key of Object.keys(this.saveSyncServices)) {
			const syncService = this.saveSyncServices[key];
			const card = syncService.createCard();
			card.addEventListener('click', (event) => {
				event.preventDefault();
				syncService.onCardClick(card);
			});
			this.cards.push(card);
		}

		// Logged in nodes
		this.importButton = DOM.create('button', {
			class: 'primary',
			childs: [DOM.icon('cloud-download-alt'), DOM.space(), DOM.text('Import')],
			disabled: true,
			events: {
				click: async (event) => {
					event.preventDefault();
					if (!this.syncService) return;
					// TODO
				},
			},
		});
		this.exportButton = DOM.create('button', {
			class: 'primary',
			childs: [DOM.icon('cloud-upload-alt'), DOM.space(), DOM.text('Export')],
			disabled: true,
			events: {
				click: async (event) => {
					event.preventDefault();
					if (!this.syncService) return;
					// TODO
				},
			},
		});
		this.deleteLogoutButton = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('trash-alt'), DOM.space(), DOM.text('Delete and Logout')],
			events: {
				click: async (event) => {
					event.preventDefault();
					if (!this.syncService) return;
					if (await this.syncService.delete()) {
						await this.syncService.logout();
						await this.syncService.clean();
						delete SaveSync.state;
					} else SimpleNotification.error({ text: `Could not delete your save, check logs.` });
					this.refresh();
				},
			},
		});
		this.logoutButton = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('sign-out-alt'), DOM.space(), DOM.text('Logout')],
			events: {
				click: async (event) => {
					event.preventDefault();
					if (!this.syncService) return;
					await this.syncService.logout();
					await this.syncService.clean();
					delete SaveSync.state;
					this.refresh();
				},
			},
		});

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
		SaveSync.state = await LocalStorage.get('saveSync');
		if (SaveSync.state !== undefined) {
			this.syncService = this.saveSyncServices[SaveSync.state.service];

			// Make summary and manage buttons
			const summary = DOM.create('p', {
				childs: [
					DOM.text('Logged in on'),
					DOM.space(),
					DOM.create('b', {
						childs: [
							(<typeof SaveSync>this.syncService.constructor).icon(),
							DOM.space(),
							DOM.text(this.syncService.constructor.name),
						],
					}),
					DOM.text('.'),
				],
			});
			DOM.append(
				this.container,
				summary,
				DOM.create('div', {
					class: 'manage',
					childs: [this.importButton, this.exportButton, this.deleteLogoutButton, this.logoutButton],
				})
			);
		} else DOM.append(this.container, ...this.cards);
	};

	toggleImportProgressState = (value: boolean): void => {
		for (const card of this.cards) {
			if (value) {
				card.classList.add('loading');
				card.title = 'Import in Progress, wait for it to finish.';
			} else {
				card.classList.remove('loading');
				card.title = '';
			}
		}

		const buttons = [this.importButton, this.exportButton, this.deleteLogoutButton, this.logoutButton];
		for (const button of buttons) {
			if (value) {
				button.classList.add('loading');
				button.title = 'Import in Progress, wait for it to finish.';
			} else {
				button.classList.remove('loading');
				button.title = '';
			}
		}
	};
}

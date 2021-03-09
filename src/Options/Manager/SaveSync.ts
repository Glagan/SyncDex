import { DOM } from '../../Core/DOM';
import { Storage } from '../../Core/Storage';
import { SaveSync } from '../../Core/SaveSync';
import { SaveSyncServices } from '../../SaveSync/Map';
import { OptionsManager } from '../OptionsManager';
import { Message } from '../../Core/Message';

interface Query {
	[key: string]: string;
}

export class SaveSyncManager {
	saveSyncServices: { [key: string]: SaveSync } = {};
	container: HTMLElement;
	cards: HTMLButtonElement[] = [];
	syncService?: SaveSync;
	importButton: HTMLButtonElement;
	exportButton: HTMLButtonElement;
	deleteLogoutButton: HTMLButtonElement;
	logoutButton: HTMLButtonElement;

	constructor() {
		this.container = document.getElementById('save-sync-container')!;

		// Create SaveSync class instances
		for (const key of Object.keys(SaveSyncServices)) {
			/// @ts-ignore saveSyncServiceClass is *NOT* abstract
			this.saveSyncServices[key] = new SaveSyncServices[key]();
		}

		// Logged out nodes
		for (const key of Object.keys(this.saveSyncServices)) {
			const syncService = this.saveSyncServices[key];
			const card = syncService.createCard();
			card.addEventListener('click', (event) => {
				event.preventDefault();
				card.classList.add('loading');
				syncService.onCardClick();
			});
			this.cards.push(card);
		}

		// Logged in nodes
		this.importButton = DOM.create('button', {
			class: 'primary',
			childs: [DOM.icon('cloud-download-alt'), DOM.space(), DOM.text('Import')],
			events: {
				click: async (event) => {
					event.preventDefault();
					if (this.importButton.classList.contains('loading')) return;
					if (!this.syncService) return;
					this.toggleButtons(true);
					OptionsManager.instance.toggleImportProgressState(true);
					if ((await this.syncService.import()) == SaveSyncResult.DOWNLOADED) {
						SimpleNotification.success({ text: 'Save successfully manually imported.' });
					}
					this.toggleButtons(false);
					OptionsManager.instance.toggleImportProgressState(false);
					OptionsManager.instance.reload();
				},
			},
		});
		this.exportButton = DOM.create('button', {
			class: 'primary',
			childs: [DOM.icon('cloud-upload-alt'), DOM.space(), DOM.text('Export')],
			events: {
				click: async (event) => {
					event.preventDefault();
					if (this.exportButton.classList.contains('loading')) return;
					if (!this.syncService) return;
					this.toggleButtons(true);
					OptionsManager.instance.toggleImportProgressState(true);
					if ((await this.syncService.export()) == SaveSyncResult.UPLOADED) {
						SimpleNotification.success({ text: 'Save successfully manually exported.' });
					}
					this.toggleButtons(false);
					OptionsManager.instance.toggleImportProgressState(false);
				},
			},
		});
		this.deleteLogoutButton = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('trash-alt'), DOM.space(), DOM.text('Delete and Logout')],
			events: {
				click: async (event) => {
					event.preventDefault();
					if (this.exportButton.classList.contains('loading')) return;
					this.toggleButtons(true);
					if (!this.syncService) return;
					if (!(await this.syncService.delete())) {
						SimpleNotification.error({ text: `Could not delete your save, check logs.` });
					}
					await this.syncService.logout();
					this.toggleButtons(false);
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
					if (this.exportButton.classList.contains('loading')) return;
					if (!this.syncService) return;
					await this.syncService.logout();
					this.refresh();
				},
			},
		});

		this.initialize();
	}

	toggleButtons(value: boolean) {
		this.importButton.disabled = value;
		this.exportButton.disabled = value;
		this.deleteLogoutButton.disabled = value;
		this.logoutButton.disabled = value;
	}

	async initialize() {
		// Check if there is a token being received for a save sync service
		const query: Query = {};
		const queryString = window.location.search.substring(1);
		queryString
			.split('&')
			.map((s) => s.split('='))
			.forEach((s) => (query[s[0]] = s[1]));
		if (query.for && query.for !== '') {
			// Remove token from the URL and remove it from History
			window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}`);
			if (query.error !== undefined) {
				SimpleNotification.error(
					{
						title: 'API Error',
						text: `The API to retrieve a code returned an error: ${query.error}\n${query.error_description}`,
					},
					{ sticky: true }
				);
			} else {
				this.container.appendChild(DOM.create('p', { textContent: 'Loading...' }));
				let found = false;
				for (const key of Object.keys(this.saveSyncServices)) {
					const syncService = this.saveSyncServices[key];
					if (syncService.constructor.name == query.for) {
						SimpleNotification.success({ text: `Login in on **${syncService.name}**...` });
						const result = await syncService.login(query);
						if (result == SaveSyncLoginResult.SUCCESS) {
							SimpleNotification.success({
								text: `Connected to **${syncService.name}**.`,
							});
							await Message.send('saveSync:start', { delay: 0 });
						} else if (result == SaveSyncLoginResult.STATE_ERROR) {
							SimpleNotification.error(
								{
									title: 'State Error',
									text: `A code to generate a token was received but there is no saved state or it is invalid, try again.`,
								},
								{ sticky: true }
							);
						} else if (result == SaveSyncLoginResult.API_ERROR) {
							SimpleNotification.error({ title: 'API Error', text: `Retry later.` });
						}
						found = true;
						break;
					}
				}
				if (!found) {
					SimpleNotification.error(
						{ text: `No **Save Sync** manager found for **${query.for}**, open an issue.` },
						{ sticky: true }
					);
				}
				this.refresh();
			}
		} else this.refresh();
	}

	async refresh() {
		DOM.clear(this.container);
		SaveSync.state = await Storage.get('saveSync');
		if (SaveSync.state !== undefined) {
			this.syncService = this.saveSyncServices[SaveSync.state.service];

			// Make summary and manage buttons
			const summary = DOM.create('p', {
				childs: [
					DOM.text('Logged in on'),
					DOM.space(),
					DOM.create('b', {
						childs: [this.syncService.icon, DOM.space(), DOM.text(this.syncService.name)],
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
	}

	toggleImportProgressState(value: boolean) {
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
				button.disabled = true;
				button.classList.add('loading');
				button.title = 'Import in Progress, wait for it to finish.';
			} else {
				button.disabled = false;
				button.classList.remove('loading');
				button.title = '';
			}
		}
	}
}

import { Options } from '../../src/Options';
import { DOM, AppendableElement } from '../../src/DOM';
import { LoginStatus } from '../../src/Service/Service';
import { ManageableService, ActivableModule } from '../Service/Service';
import { MyMangaDex } from '../Service/MyMangaDex';
import { SyncDex } from '../Service/SyncDex';
import { MangaDex } from '../Service/MangaDex';
import { MyAnimeList } from '../Service/MyAnimeList';
import { Anilist } from '../Service/Anilist';
import { Kitsu } from '../Service/Kitsu';
import { AnimePlanet } from '../Service/AnimePlanet';
import { MangaUpdates } from '../Service/MangaUpdates';

export enum ServiceName {
	MyMangaDex = 'MyMangaDex',
	SyncDex = 'SyncDex',
	MangaDex = 'MangaDex',
	MyAnimeList = 'MyAnimeList',
	MangaUpdates = 'MangaUpdates',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	AnimePlanet = 'AnimePlanet',
}

export const enum SaveMethod {
	IMPORT = 'IMPORT',
	EXPORT = 'EXPORT',
}

export class ServiceManager {
	managers: ManageableService[] = [
		new MyMangaDex(this),
		new SyncDex(this),
		new MangaDex(this),
		new MyAnimeList(this),
		new Anilist(this),
		new Kitsu(this),
		new AnimePlanet(this),
		new MangaUpdates(this),
	];
	// Active
	activeContainer: HTMLElement;
	mainService?: ManageableService;
	noServices: HTMLElement;
	activeServices: ServiceName[] = [];
	inactiveServices: ServiceName[] = [];
	inactiveWarning: HTMLElement;
	// Import/Export
	saveContainer: HTMLElement;

	constructor(active: HTMLElement, saveContainer: HTMLElement) {
		this.activeContainer = active;
		this.saveContainer = saveContainer;
		// Warnings
		this.noServices = document.getElementById('no-service') as HTMLElement;
		this.inactiveWarning = document.getElementById('inactive-service') as HTMLElement;
		// Bind
		for (const manager of this.managers) {
			if (manager.activeModule) {
				manager.activeModule.bind();
			}
		}
		// Default State
		this.refreshActive();
		this.resetSaveContainer();
	}

	/**
	 * Activate or desactivate all buttons in a Service card.
	 * Check if the user is logged in on the Service and calls updateStatus to display warnings.
	 */
	reloadManager = async (manager: ManageableService): Promise<void> => {
		if (!manager.activeModule) return;
		const index = Options.services.indexOf(manager.service.name);
		if (Options.mainService == manager.service.name) {
			this.mainService = manager;
			this.activeContainer.insertBefore(manager.activeModule.activeCard, this.activeContainer.firstElementChild);
			manager.activeModule.activeCard.classList.add('active');
		} else if (index >= 0) {
			// Insert as the *index* child to follow the Options order
			const activeCards = this.activeContainer.querySelectorAll('.card.active');
			const length = activeCards.length;
			if (length == 0) {
				this.activeContainer.insertBefore(
					manager.activeModule.activeCard,
					this.activeContainer.firstElementChild
				);
			} else if (index >= length) {
				this.activeContainer.insertBefore(
					manager.activeModule.activeCard,
					activeCards[length - 1].nextElementSibling
				);
			} else if (index < length) {
				this.activeContainer.insertBefore(manager.activeModule.activeCard, activeCards[index]);
			}
			manager.activeModule.activeCard.classList.add('active');
		} else {
			this.activeContainer.appendChild(manager.activeModule.activeCard);
		}
		// Update displayed state (buttons)
		if (index >= 0) {
			manager.activeModule.loading();
			manager.service.loggedIn().then((status) => {
				(manager.activeModule as ActivableModule).updateStatus(status);
			});
		} else {
			manager.activeModule.desactivate();
		}
	};

	/**
	 * Update the inactiveServices list and display warnings if the status isn't SUCCESS
	 */
	updateServiceStatus = (name: ServiceName, status: LoginStatus): void => {
		const index = this.inactiveServices.indexOf(name);
		if (index > -1) {
			if (status == LoginStatus.SUCCESS) {
				this.inactiveServices.splice(index, 1);
				if (this.inactiveServices.length == 0) {
					this.inactiveWarning.classList.add('hidden');
				}
			}
		} else if (status != LoginStatus.SUCCESS) {
			this.inactiveServices.push(name);
			this.inactiveWarning.classList.remove('hidden');
		}
	};

	/**
	 * Update active Services list and remove warning notifications if necessary
	 */
	removeActiveService = (name: ServiceName): void => {
		const index = this.inactiveServices.indexOf(name);
		if (index > -1) {
			this.inactiveServices.splice(index, 1);
			if (this.inactiveServices.length == 0) {
				this.inactiveWarning.classList.add('hidden');
			}
		}
	};

	/**
	 * Remove all visible activable services and insert them in order.
	 * Also check the status with activateService
	 */
	refreshActive = (): void => {
		// Remove previous
		DOM.clear(this.activeContainer);
		this.activeServices = [];
		this.inactiveServices = [];
		// Insert all Services card
		for (const manager of this.managers) {
			this.reloadManager(manager);
		}
		if (Options.services.length == 0) {
			this.noServices.classList.remove('hidden');
		}
	};

	// Import/Export

	/**
	 * Proxy to the header function with an h1 header
	 */
	fullHeader = (value: string | AppendableElement[]): HTMLElement => {
		return this.header(value, 'h1');
	};

	/**
	 * Append an header in the save container
	 */
	header = (value: string | AppendableElement[], headerType: 'h1' | 'h2' = 'h2'): HTMLElement => {
		const isArray = Array.isArray(value);
		return this.saveContainer.appendChild(
			DOM.create(headerType, {
				class: 'full',
				textContent: isArray ? '' : (value as string),
				childs: isArray ? (value as AppendableElement[]) : [],
			})
		);
	};

	/**
	 * Remove everything from the save container
	 */
	clearSaveContainer = (): void => {
		DOM.clear(this.saveContainer);
	};

	/**
	 * Remove the save container and the Import/Export categories with buttons for each services
	 */
	resetSaveContainer = (): void => {
		this.clearSaveContainer();
		// Import/Export containers
		const importContainer = DOM.create('div', {
			class: 'services selectable',
			childs: [],
		});
		const exportContainer = DOM.create('div', {
			class: 'services selectable',
			childs: [],
		});
		// Insert Service cards
		for (const service of this.managers) {
			if (service.importModule) {
				DOM.append(importContainer, service.importModule.importCard);
			}
			if (service.exportModule) {
				DOM.append(exportContainer, service.exportModule.exportCard);
			}
		}
		// Append to container
		DOM.append(
			this.saveContainer,
			DOM.create('h1', {
				attributes: { id: 'import' },
				childs: [DOM.icon('download'), DOM.space(), DOM.text('Import')],
			}),
			DOM.create('div', {
				childs: [
					DOM.create('div', {
						class: 'block notification info',
						childs: [
							DOM.create('b', { textContent: 'Importing' }),
							DOM.text(' will only update your '),
							DOM.create('b', { textContent: 'SyncDex' }),
							DOM.text(' save and is used to initialize '),
							DOM.create('b', { textContent: 'SyncDex' }),
							DOM.create('br'),
							DOM.text('If you wish to update any external Service, see '),
							DOM.create('b', {
								childs: [DOM.create('a', { attributes: { href: '#Export' }, textContent: 'Export' })],
							}),
						],
					}),
					importContainer,
				],
			}),
			DOM.create('h1', {
				attributes: { id: 'export' },
				childs: [DOM.icon('upload'), DOM.space(), DOM.text('Export')],
			}),
			DOM.create('div', {
				childs: [
					DOM.create('div', {
						class: 'block notification info',
						childs: [
							DOM.create('b', { textContent: 'Exporting' }),
							DOM.text(' will update your '),
							DOM.create('b', { textContent: 'Online' }),
							DOM.text(' save on the Service you choose using your '),
							DOM.create('b', { textContent: 'SyncDex' }),
							DOM.text(' save.'),
							DOM.create('br'),
							DOM.text('You should '),
							DOM.create('b', {
								childs: [DOM.create('a', { attributes: { href: '#Import' }, textContent: 'Import' })],
							}),
							DOM.text(' from somewhere before exporting to somewhere else !'),
						],
					}),
					exportContainer,
				],
			})
		);
	};

	reloadOptions = (): void => {};
}

import { Options } from '../../src/Options';
import { DOM, AppendableElement } from '../../src/DOM';
import { LoginStatus } from '../../src/Service/Service';
import { ManageableService } from '../Service/Service';
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
	addForm: HTMLElement;
	selector: HTMLSelectElement;
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
		// Active
		this.addForm = DOM.create('div', {
			class: 'service add',
		});
		this.selector = DOM.create('select', {
			childs: [DOM.create('option', { textContent: 'Select Service' })],
		});
		this.noServices = document.getElementById('no-service') as HTMLElement;
		this.inactiveWarning = document.getElementById('inactive-service') as HTMLElement;
		this.createAddForm();
		// Default State
		this.refreshActive();
		this.resetSaveContainer();
	}

	// Active

	/**
	 * Activate a service, display it's card and remove it from the "Add" form list.
	 * Check if the user is logged in on the Service and calls updateStatus to display warnings.
	 */
	activateService = async (serviceName: ServiceName): Promise<void> => {
		let manager = this.managers.find((manager) => manager.service.name == serviceName);
		if (!manager || !manager.activeModule) return;
		if (Options.mainService == serviceName) {
			this.mainService = manager;
			manager.activeModule.activeCard.classList.add('main');
			manager.activeModule.mainButton.classList.add('hidden');
		}
		this.managers.push(manager);
		// Main Service is always first -- if a Service is upgraded to Main it's moved to the first position
		this.activeContainer.insertBefore(manager.activeModule.activeCard, this.activeContainer.lastElementChild);
		this.removeSelectorRow(manager.service.name);
		// Set logged in state
		const loggedIn = await manager.service.loggedIn();
		manager.activeModule.updateStatus(loggedIn);
	};

	/**
	 * Remove an element from the "Add" form.
	 * Also hide the form is there is no other non actived services.
	 */
	removeSelectorRow = (service: ServiceName): void => {
		const option = this.selector.querySelector(`[value="${service}"]`);
		if (option) {
			option.remove();
		}
		if (this.selector.childElementCount == 1) {
			this.addForm.classList.add('hidden');
		}
		this.noServices.classList.add('hidden');
	};

	/**
	 * Add an element to the list of Services that can be added in the "Add" form
	 */
	addSelectorRow = (service: ServiceName): void => {
		this.addForm.classList.remove('hidden');
		DOM.append(
			this.selector,
			DOM.create('option', {
				textContent: service,
				attributes: {
					value: service,
				},
			})
		);
		if (Options.services.length == 0) {
			this.noServices.classList.remove('hidden');
		}
		const index = this.inactiveServices.indexOf(service);
		if (index > -1) {
			this.inactiveServices.splice(index, 1);
			if (this.inactiveServices.length == 0) {
				this.inactiveWarning.classList.add('hidden');
			}
		}
	};

	/**
	 * Create and append the "Add" button in the active (services) container
	 */
	createAddForm = (): HTMLElement => {
		// Add all options to the selector
		for (const manager of this.managers) {
			if (manager.activeModule) {
				manager.activeModule.bind();
				this.addSelectorRow(manager.service.name);
			}
		}
		// Button to add the service to the active list
		const button = DOM.create('button', {
			class: 'success',
			childs: [DOM.icon('circle-plus'), DOM.space(), DOM.text('Add')],
			events: {
				click: async (): Promise<any> => {
					if (this.selector.value != 'Select Service') {
						const name = this.selector.value as ServiceName;
						if (Options.services.length == 0) {
							Options.mainService = name as any;
						}
						Options.services.push(name as any);
						await Options.save();
						this.activateService(name);
					}
				},
			},
		});
		this.activeContainer.appendChild(DOM.append(this.addForm, this.selector, button));
		return this.selector;
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
	 * Remove all visible activable services and insert them in order.
	 * Also check the status with activateService
	 */
	refreshActive = (): void => {
		// Remove previous
		for (const service of this.managers) {
			if (service.activeModule) {
				service.activeModule.activeCard.remove();
			}
		}
		this.activeServices = [];
		this.inactiveServices = [];
		// Insert current Services
		for (const serviceName of Options.services) {
			this.activateService(serviceName);
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

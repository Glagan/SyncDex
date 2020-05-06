import { Options } from '../../src/Options';
import { DOM, AppendableElement } from '../../src/DOM';
import { LoginStatus } from '../../src/Service/Service';
import { Service } from '../Service/Service';
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
	services: Service[] = [
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
	mainService?: Service;
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

	activateService = async (serviceName: ServiceName): Promise<void> => {
		let service = this.services.find((service) => service.name == serviceName);
		if (!service || !service.activeModule) return;
		if (Options.mainService == serviceName) {
			this.mainService = service;
			service.activeModule.activeCard.classList.add('main');
			service.activeModule.mainButton.classList.add('hidden');
		}
		this.services.push(service);
		// Main Service is always first -- if a Service is upgraded to Main it's moved to the first position
		this.activeContainer.insertBefore(service.activeModule.activeCard, this.activeContainer.lastElementChild);
		this.removeSelectorRow(service.name);
		// Set logged in state
		const loggedIn = await service.activeModule.isLoggedIn();
		service.activeModule.updateStatus(loggedIn);
	};

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

	createAddForm = (): HTMLElement => {
		// Add all options to the selector
		for (const service of this.services) {
			if (service.activeModule) {
				this.addSelectorRow(service.name);
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

	refreshActive = (): void => {
		// Remove previous
		for (const service of this.services) {
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

	fullHeader = (value: string | AppendableElement[]): HTMLElement => {
		return this.header(value, 'h1');
	};

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

	clearSaveContainer = (): void => {
		DOM.clear(this.saveContainer);
	};

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
		for (const service of this.services) {
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
}

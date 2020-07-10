import { Options } from '../../src/Options';
import { DOM } from '../../src/DOM';
import { Service, ActivableModule } from '../Service/Service';
import { MyMangaDex } from '../Service/MyMangaDex';
import { SyncDex } from '../Service/SyncDex';
import { MangaDex } from '../Service/MangaDex';
import { MyAnimeList } from '../Service/MyAnimeList';
import { Anilist } from '../Service/Anilist';
import { Kitsu } from '../Service/Kitsu';
import { AnimePlanet } from '../Service/AnimePlanet';
import { MangaUpdates } from '../Service/MangaUpdates';
import { RequestStatus } from '../../src/Runtime';

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
	mainService?: Service;
	noServices: HTMLElement;
	activeServices: ServiceName[] = [];
	inactiveServices: ServiceName[] = [];
	inactiveWarning: HTMLElement;
	// Import/Export
	importContainer: HTMLElement;
	exportContainer: HTMLElement;

	constructor() {
		this.activeContainer = document.getElementById('service-list')!;
		// Warnings
		this.noServices = document.getElementById('no-service')!;
		this.inactiveWarning = document.getElementById('inactive-service')!;
		// Import/Export
		this.importContainer = document.getElementById('import-container')!;
		this.exportContainer = document.getElementById('export-container')!;
		// Bind
		for (const manager of this.services) {
			if (manager.activeModule) {
				manager.activeModule.bind();
			}
		}
		// Default State
		this.refreshActive();
		this.fillSaveContainers();
	}

	/**
	 * Activate or desactivate all buttons in a Service card.
	 * Check if the user is logged in on the Service and calls updateStatus to display warnings.
	 */
	reloadManager = async (service: Service): Promise<void> => {
		if (!service.activeModule || !service.activeModule.activable) return;
		const index = Options.services.indexOf(service.name);
		if (Options.mainService == service.name) {
			this.mainService = service;
			this.activeContainer.insertBefore(service.activeModule.activeCard, this.activeContainer.firstElementChild);
			service.activeModule.activeCard.classList.add('active');
			this.addActiveService(service.name);
		} else if (index >= 0) {
			// Insert as the *index* child to follow the Options order
			const activeCards = this.activeContainer.querySelectorAll('.card.active');
			const length = activeCards.length;
			if (length == 0) {
				this.activeContainer.insertBefore(
					service.activeModule.activeCard,
					this.activeContainer.firstElementChild
				);
			} else if (index >= length) {
				this.activeContainer.insertBefore(
					service.activeModule.activeCard,
					activeCards[length - 1].nextElementSibling
				);
			} else if (index < length) {
				this.activeContainer.insertBefore(service.activeModule.activeCard, activeCards[index]);
			}
			service.activeModule.activeCard.classList.add('active');
			this.addActiveService(service.name);
		} else {
			this.activeContainer.appendChild(service.activeModule.activeCard);
		}
		// Update displayed state (buttons)
		if (index >= 0) {
			service.activeModule.loading();
			service.activeModule.loggedIn().then((status) => {
				(service.activeModule as ActivableModule).updateStatus(status);
			});
		} else {
			service.activeModule.desactivate();
		}
	};

	/**
	 * Update the inactiveServices list and display warnings if the status isn't SUCCESS
	 */
	updateServiceStatus = (name: ServiceName, status: RequestStatus): void => {
		const index = this.inactiveServices.indexOf(name);
		if (index > -1) {
			if (status == RequestStatus.SUCCESS) {
				this.inactiveServices.splice(index, 1);
				if (this.inactiveServices.length == 0) {
					this.inactiveWarning.classList.add('hidden');
				}
			}
		} else if (status != RequestStatus.SUCCESS) {
			this.inactiveServices.push(name);
			this.inactiveWarning.classList.remove('hidden');
		}
	};

	/**
	 * Update active Services list and remove warning notifications if necessary
	 */
	addActiveService = (name: ServiceName): void => {
		this.activeServices.push(name);
		this.noServices.classList.add('hidden');
	};

	/**
	 * Update active and inactive Services list and remove warning notifications if necessary
	 */
	removeActiveService = (name: ServiceName): void => {
		let index = this.inactiveServices.indexOf(name);
		if (index > -1) {
			this.inactiveServices.splice(index, 1);
			if (this.inactiveServices.length == 0) {
				this.inactiveWarning.classList.add('hidden');
			}
		}
		index = this.activeServices.indexOf(name);
		if (index > -1) {
			this.activeServices.splice(index, 1);
			if (this.activeServices.length == 0) {
				this.noServices.classList.remove('hidden');
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
		this.noServices.classList.add('hidden');
		this.inactiveWarning.classList.add('hidden');
		// Insert all Services card
		for (const manager of this.services) {
			this.reloadManager(manager);
		}
		if (this.activeServices.length == 0) {
			this.noServices.classList.remove('hidden');
		} else {
			this.noServices.classList.add('hidden');
		}
	};

	// Import/Export

	fillSaveContainers = (): void => {
		for (const service of this.services) {
			if (service.importModule) {
				DOM.append(this.importContainer, service.importModule.card);
			}
			if (service.exportModule) {
				DOM.append(this.exportContainer, service.exportModule.card);
			}
		}
	};

	reloadOptions = (): void => {};
}

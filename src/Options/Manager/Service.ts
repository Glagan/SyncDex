import { DOM } from '../../Core/DOM';
import { ActivableKey, Service } from '../../Core/Service';

export class ServiceManager {
	services: Service[] = [];
	// Active
	activeContainer: HTMLElement;
	mainService?: Service;
	noServices: HTMLElement;
	activeServices: ActivableKey[] = [];
	inactiveServices: ActivableKey[] = [];
	inactiveWarning: HTMLElement;

	constructor() {
		this.activeContainer = document.getElementById('service-list')!;
		// Warnings
		this.noServices = document.getElementById('no-service')!;
		this.inactiveWarning = document.getElementById('inactive-service')!;
		// Create Services and bind them
		/*for (const serviceName in ActivableName) {
			// `service` is *NOT* an abstract class
			const ServiceConstructor = Services[key];
			/// @ts-ignore
			const service = new ServiceConstructor(this) as Service;
			if (isActivable(service)) {
				this.services.push(service);
				service.activeModule.bind();
			} else console.error(`${service.serviceName} is set as Activable but has missing modules.`);
		}*/
		// Default State
		this.refreshActive();
	}

	/**
	 * Activate or desactivate all buttons in a Service card.
	 * Check if the user is logged in on the Service and calls updateStatus to display warnings.
	 */
	reloadManager = async (service: Service): Promise<void> => {
		/*const index = Options.services.indexOf(service.key as ActivableKey);
		if (Options.mainService == service.key) {
			this.mainService = service;
			this.activeContainer.insertBefore(service.activeModule.activeCard, this.activeContainer.firstElementChild);
			service.activeModule.activeCard.classList.add('active');
			this.addActiveService(service.key);
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
			this.addActiveService(service.key as ActivableKey);
		} else {
			this.activeContainer.appendChild(service.activeModule.activeCard);
		}
		// Update displayed state (buttons)
		if (index >= 0) {
			service.activeModule.loading();
			service.loginModule!.loggedIn().then((status) => service.activeModule!.updateStatus(status));
		} else {
			service.activeModule.desactivate();
		}*/
	};

	/**
	 * Update the inactiveServices list and display warnings if the status isn't SUCCESS
	 */
	updateServiceStatus = (key: ActivableKey, status: RequestStatus): void => {
		const index = this.inactiveServices.indexOf(key);
		if (index > -1) {
			if (status == RequestStatus.SUCCESS) {
				this.inactiveServices.splice(index, 1);
				if (this.inactiveServices.length == 0) {
					this.inactiveWarning.classList.add('hidden');
				}
			}
		} else if (status != RequestStatus.SUCCESS) {
			this.inactiveServices.push(key);
			this.inactiveWarning.classList.remove('hidden');
		}
	};

	/**
	 * Update active Services list and remove warning notifications if necessary
	 */
	addActiveService = (key: ActivableKey): void => {
		this.activeServices.push(key);
		this.noServices.classList.add('hidden');
	};

	/**
	 * Update active and inactive Services list and remove warning notifications if necessary
	 */
	removeActiveService = (key: ActivableKey): void => {
		let index = this.inactiveServices.indexOf(key);
		if (index > -1) {
			this.inactiveServices.splice(index, 1);
			if (this.inactiveServices.length == 0) {
				this.inactiveWarning.classList.add('hidden');
			}
		}
		index = this.activeServices.indexOf(key);
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
}

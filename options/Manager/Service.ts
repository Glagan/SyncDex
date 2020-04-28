import { Options } from '../../src/Options';
import { DOM } from '../../src/DOM';
import { ServiceName, Service, ServiceKey, LoginStatus } from '../../src/Service/Service';
import { ServiceClass } from '../../src/Service/ServiceClass';
import { ServiceHelper } from '../ServiceHelper';

class ServiceOptions {
	serviceName: ServiceName;
	node: HTMLElement;
	mainButton: HTMLElement;
	checkStatusButton: HTMLElement;
	removeButton: HTMLElement;
	service: Service;

	constructor(service: Service, name: ServiceName) {
		this.service = service;
		this.serviceName = name;
		this.node = ServiceHelper.createBlock(this.serviceName, ServiceKey[this.serviceName]);
		this.node.classList.add('loading');
		const buttons = DOM.create('div', { class: 'button-group' });
		this.mainButton = DOM.create('button', {
			class: 'default',
			attributes: { title: 'Set as main' },
			childs: [DOM.create('i', { class: 'lni lni-angle-double-left' })],
		});
		this.checkStatusButton = DOM.create('button', {
			class: 'action',
			attributes: { title: 'Check login status' },
			childs: [DOM.create('i', { class: 'lni lni-reload' })],
		});
		this.removeButton = DOM.create('button', {
			class: 'danger grow',
			childs: [DOM.create('i', { class: 'lni lni-cross-circle' }), DOM.space(), DOM.text('Remove')],
		});
		DOM.append(this.node, DOM.append(buttons, this.mainButton, this.checkStatusButton, this.removeButton));
	}

	bind = async (manager: ServiceManager): Promise<void> => {
		// Load current state
		if (Options.mainService == this.serviceName) {
			this.node.classList.add('main');
			this.mainButton.classList.add('hidden');
		}
		this.service.loggedIn().then((loggedIn) => this.updateStatus(manager, loggedIn));
		manager.removeSelectorRow(this.serviceName);
		// Add events
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = Options.services.indexOf(this.serviceName);
			manager.services.splice(0, 0, manager.services.splice(index, 1)[0]);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.serviceName;
			Options.save();
			// Remove main button and add the main button to the previous main
			if (manager.mainService) {
				manager.mainService.node.classList.remove('main');
				manager.mainService.mainButton.classList.remove('hidden');
			}
			manager.mainService = this;
			this.mainButton.classList.add('hidden');
			this.node.classList.add('main');
			this.node.parentElement?.insertBefore(this.node, this.node.parentElement.firstElementChild);
		});
		let busy = false;
		this.checkStatusButton.addEventListener('click', () => {
			if (!busy) {
				busy = true;
				this.node.classList.remove('active', 'inactive');
				this.node.classList.add('loading');
				this.service.loggedIn().then((loggedIn) => this.updateStatus(manager, loggedIn));
				busy = false;
			}
		});
		this.removeButton.addEventListener('click', () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.serviceName);
			if (index > -1) {
				manager.services.splice(index, 1);
				Options.services.splice(index, 1);
				if (Options.mainService == this.serviceName) {
					Options.mainService = Options.services.length > 0 ? Options.services[0] : undefined;
				}
			}
			Options.save();
			// Remove service block and add the option back to the selector
			this.node.remove();
			manager.addSelectorRow(this.serviceName);
			// Set the new main
			if (Options.mainService) {
				manager.services[0].node.classList.add('main');
				manager.services[0].mainButton.classList.add('hidden');
				manager.mainService = manager.services[0];
			} else {
				manager.mainService = undefined;
			}
		});
	};

	updateStatus = (manager: ServiceManager, status: LoginStatus): void => {
		this.node.classList.remove('loading');
		if (status == LoginStatus.SUCCESS) {
			this.node.classList.add('active');
		} else {
			this.node.classList.add('inactive');
		}
		manager.updateServiceStatus(this.serviceName, status);
	};
}

export class ServiceManager {
	node: HTMLElement;
	services: ServiceOptions[] = [];
	addForm: HTMLElement;
	selector: HTMLSelectElement;
	mainService?: ServiceOptions;
	noServices: HTMLElement;
	inactiveServices: ServiceName[] = [];
	inactiveWarnig: HTMLElement;

	constructor(node: HTMLElement) {
		this.node = node;
		this.addForm = DOM.create('div', {
			class: 'service add',
		});
		this.selector = DOM.create('select', {
			childs: [DOM.create('option', { textContent: 'Select Service' })],
		});
		this.noServices = document.getElementById('no-service') as HTMLElement;
		this.inactiveWarnig = document.getElementById('inactive-service') as HTMLElement;
		this.createAddForm();
		this.updateAll();
	}

	addService = (serviceName: ServiceName): void => {
		const service = ServiceClass(serviceName);
		const serviceOptions = new ServiceOptions(service, serviceName);
		if (Options.mainService == serviceName) {
			this.mainService = serviceOptions;
		}
		serviceOptions.bind(this);
		this.services.push(serviceOptions);
		this.node.insertBefore(serviceOptions.node, this.node.lastElementChild);
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
				this.inactiveWarnig.classList.add('hidden');
			}
		}
	};

	createAddForm = (): HTMLElement => {
		// Add all options to the selector
		for (const service in ServiceName) {
			if (isNaN(Number(service))) {
				this.addSelectorRow(service as ServiceName);
			}
		}
		// Button to add the service to the active list
		const button = DOM.create('button', {
			class: 'success',
			childs: [DOM.create('i', { class: 'lni lni-circle-plus' }), DOM.space(), DOM.text('Add')],
			events: {
				click: async (): Promise<any> => {
					if (this.selector.value != 'Select Service') {
						const name = this.selector.value as ServiceName;
						if (Options.services.length == 0) {
							Options.mainService = name;
						}
						Options.services.push(name);
						await Options.save();
						this.addService(name);
					}
				},
			},
		});
		this.node.appendChild(DOM.append(this.addForm, this.selector, button));
		return this.selector;
	};

	updateServiceStatus = (name: ServiceName, status: LoginStatus): void => {
		const index = this.inactiveServices.indexOf(name);
		if (index > -1) {
			if (status == LoginStatus.SUCCESS) {
				this.inactiveServices.splice(index, 1);
				if (this.inactiveServices.length == 0) {
					this.inactiveWarnig.classList.add('hidden');
				}
			}
		} else if (!status) {
			this.inactiveServices.push(name);
			this.inactiveWarnig.classList.remove('hidden');
		}
	};

	updateAll = (): void => {
		// Remove previous
		for (let index = 0; index < this.services.length; index++) {
			this.services[index].node.remove();
		}
		this.services = [];
		this.inactiveServices = [];
		// Insert current Services
		for (let index = 0; index < Options.services.length; index++) {
			const serviceName = Options.services[index] as ServiceName;
			this.addService(serviceName);
		}
		if (Options.services.length == 0) {
			this.noServices.classList.remove('hidden');
		}
	};
}

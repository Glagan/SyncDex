import { Options } from '../../src/Options';
import { DOM } from '../../src/DOM';
import { ServiceName, Service, ServiceKey } from '../../src/Service/Service';
import { ServiceClass } from '../../src/Service/ServiceClass';

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
		this.node = DOM.create('div', {
			class: 'service loading',
		});
		const title = DOM.create('span', {
			class: 'title',
			childs: [
				DOM.create('img', {
					attributes: { src: `/icons/${ServiceKey[name]}.png` },
				}),
				DOM.space(),
				this.createTitle(),
			],
		});
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
			childs: [
				DOM.create('i', { class: 'lni lni-cross-circle' }),
				DOM.space(),
				DOM.text('Remove'),
			],
		});
		DOM.append(
			this.node,
			title,
			DOM.append(buttons, this.mainButton, this.checkStatusButton, this.removeButton)
		);
	}

	bind = async (manager: ServiceManager): Promise<void> => {
		// Load current state
		const options = manager.options;
		if (options.mainService == this.serviceName) {
			this.node.classList.add('main');
			this.mainButton.classList.add('hidden');
		}
		this.service.loggedIn().then((loggedIn) => this.updateStatus(manager, loggedIn));
		manager.removeSelectorRow(this.serviceName);
		// Add events
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = options.services.indexOf(this.serviceName);
			manager.services.splice(0, 0, manager.services.splice(index, 1)[0]);
			options.services.splice(0, 0, options.services.splice(index, 1)[0]);
			options.mainService = this.serviceName;
			options.save();
			// Remove main button and add the main button to the previous main
			if (manager.mainService) {
				manager.mainService.node.classList.remove('main');
				manager.mainService.mainButton.classList.remove('hidden');
			}
			manager.mainService = this;
			this.mainButton.classList.add('hidden');
			this.node.classList.add('main');
			this.node.parentElement?.insertBefore(
				this.node,
				this.node.parentElement.firstElementChild
			);
		});
		this.checkStatusButton.addEventListener('click', () => {
			this.node.classList.remove('active', 'inactive');
			this.node.classList.add('loading');
			this.service.loggedIn().then((loggedIn) => this.updateStatus(manager, loggedIn));
		});
		this.removeButton.addEventListener('click', () => {
			// Remove service from Service list and assign new main if possible
			const index = options.services.indexOf(this.serviceName);
			if (index > -1) {
				manager.services.splice(index, 1);
				options.services.splice(index, 1);
				if (options.mainService == this.serviceName) {
					options.mainService =
						options.services.length > 0 ? options.services[0] : undefined;
				}
			}
			options.save();
			// Remove service block and add the option back to the selector
			this.node.remove();
			manager.addSelectorRow(this.serviceName);
			// Set the new main
			if (options.mainService) {
				manager.services[0].node.classList.add('main');
				manager.services[0].mainButton.classList.add('hidden');
				manager.mainService = manager.services[0];
			} else {
				manager.mainService = undefined;
			}
		});
	};

	updateStatus = (manager: ServiceManager, status: boolean): void => {
		this.node.classList.remove('loading');
		if (status) {
			this.node.classList.add('active');
		} else {
			this.node.classList.add('inactive');
		}
		manager.updateServiceStatus(this.serviceName, status);
	};

	createTitle = (): HTMLElement => {
		if (this.serviceName == ServiceName.Anilist) {
			return DOM.create('span', {
				class: this.serviceName.toLowerCase(),
				textContent: 'Ani',
				childs: [
					DOM.create('span', {
						class: 'list',
						textContent: 'list',
					}),
				],
			});
		}
		return DOM.create('span', {
			class: this.serviceName.toLowerCase(),
			textContent: this.serviceName,
		});
	};
}

export class ServiceManager {
	node: HTMLElement;
	options: Options;
	services: ServiceOptions[] = [];
	addForm: HTMLElement;
	selector: HTMLSelectElement;
	mainService?: ServiceOptions;
	noServices: HTMLElement;
	inactiveServices: ServiceName[] = [];
	inactiveWarnig: HTMLElement;

	constructor(node: HTMLElement, options: Options) {
		this.options = options;
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
		for (let index = 0; index < this.options.services.length; index++) {
			const serviceName = this.options.services[index] as ServiceName;
			this.addService(serviceName);
		}
		if (this.options.services.length == 0) {
			this.noServices.classList.remove('hidden');
		}
	}

	addService = (serviceName: ServiceName): void => {
		const service = ServiceClass(serviceName, this.options);
		const serviceOptions = new ServiceOptions(service, serviceName);
		if (this.options.mainService == serviceName) {
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
		if (this.options.services.length == 0) {
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
			childs: [
				DOM.create('i', { class: 'lni lni-circle-plus' }),
				DOM.space(),
				DOM.text('Add'),
			],
			events: {
				click: async (): Promise<any> => {
					if (this.selector.value != 'Select Service') {
						const name = this.selector.value as ServiceName;
						if (this.options.services.length == 0) {
							this.options.mainService = name;
						}
						this.options.services.push(name);
						this.options.save();
						this.addService(name);
					}
				},
			},
		});
		this.node.appendChild(DOM.append(this.addForm, this.selector, button));
		return this.selector;
	};

	updateServiceStatus = (name: ServiceName, status: boolean): void => {
		const index = this.inactiveServices.indexOf(name);
		if (index > -1) {
			if (status) {
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
}

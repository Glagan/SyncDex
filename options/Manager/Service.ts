import { Options } from '../../src/Options';
import { DOM } from '../../src/DOM';
import { ServiceName, Service, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { ServiceClass } from '../../src/Service/ServiceClass';
import { ServiceHelper } from '../ServiceHelper';

class ServiceOptions {
	service: Service;
	node: HTMLElement;
	mainButton: HTMLElement;
	checkStatusButton: HTMLElement;
	loginButton: HTMLElement;
	loginForm?: HTMLFormElement;
	removeButton: HTMLElement;

	constructor(service: Service) {
		this.service = service;
		this.node = ServiceHelper.createBlock(this.service.name, this.service.key);
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
		this.loginButton = DOM.create('a', {
			class: 'button success hidden',
			attributes: {
				title: 'Login',
				href: this.service.loginUrl,
				rel: 'noreferrer noopener',
				target: '_blank',
			},
			childs: [DOM.create('i', { class: 'lni lni-link' }), DOM.space(), DOM.text('Login')],
		});
		this.removeButton = DOM.create('button', {
			class: 'danger grow',
			childs: [DOM.create('i', { class: 'lni lni-cross-circle' }), DOM.space(), DOM.text('Remove')],
		});
		DOM.append(
			this.node,
			DOM.append(buttons, this.mainButton, this.loginButton, this.checkStatusButton, this.removeButton)
		);
	}

	bind = async (manager: ServiceManager): Promise<void> => {
		// Load current state
		if (Options.mainService == this.service.name) {
			this.node.classList.add('main');
			this.mainButton.classList.add('hidden');
		}
		this.service.loggedIn().then((loggedIn) => this.updateStatus(manager, loggedIn));
		manager.removeSelectorRow(this.service.name);
		// Add events
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = Options.services.indexOf(this.service.name);
			manager.services.splice(0, 0, manager.services.splice(index, 1)[0]);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.service.name;
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
				this.loginButton.classList.add('hidden');
				this.node.classList.remove('active', 'inactive');
				this.node.classList.add('loading');
				if (this.loginForm) {
					this.loginForm.remove();
					this.loginForm = undefined;
				}
				this.service.loggedIn().then((loggedIn) => this.updateStatus(manager, loggedIn));
				busy = false;
			}
		});
		this.removeButton.addEventListener('click', async () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.service.name);
			if (index > -1) {
				manager.services.splice(index, 1);
				Options.services.splice(index, 1);
				if (Options.mainService == this.service.name) {
					Options.mainService = Options.services.length > 0 ? Options.services[0] : undefined;
				}
			}
			// Execute logout actions
			if (this.service.logout !== undefined) {
				await this.service.logout();
			}
			// Save
			Options.save();
			// Remove service block and add the option back to the selector
			this.node.remove();
			manager.addSelectorRow(this.service.name);
			// Set the new main
			if (Options.mainService) {
				manager.services[0].node.classList.add('main');
				manager.services[0].mainButton.classList.add('hidden');
				manager.mainService = manager.services[0];
			} else {
				manager.mainService = undefined;
			}
		});
		this.loginButton.addEventListener('click', (event) => {
			if (this.service.loginMethod == LoginMethod.FORM) {
				event.preventDefault();
				if (this.loginForm) return;
				this.loginForm = DOM.create('form', {
					class: 'service-login',
					childs: [
						DOM.create('input', {
							attributes: { type: 'text', name: 'username', placeholder: 'Email', required: 'true' },
						}),
						DOM.create('input', {
							attributes: {
								type: 'password',
								name: 'password',
								placeholder: 'Password',
								required: 'true',
							},
						}),
						DOM.create('button', {
							class: 'success',
							attributes: { type: 'submit' },
							textContent: 'Login',
						}),
					],
				});
				let busy = false;
				this.loginForm.addEventListener('submit', async (event) => {
					event.preventDefault();
					if (this.loginForm === undefined) return;
					if (!busy) {
						busy = true;
						this.node.classList.add('loading');
						this.loginForm.classList.add('hidden');
						if (this.service.login) {
							// Login call Options.save itself
							const res = await this.service.login(
								this.loginForm.username.value.trim(),
								this.loginForm.password.value
							);
							if (res == LoginStatus.SUCCESS) {
								this.loginForm.remove();
								this.loginForm = undefined;
								this.node.classList.remove('inactive', 'loading');
								this.node.classList.add('active');
								this.loginButton.classList.add('hidden');
								this.updateStatus(manager, res);
								return;
							}
						}
						// If there was an error -- show the form again
						// TODO: Notification
						this.loginForm.classList.remove('hidden');
						busy = false;
					}
				});
				this.node.appendChild(this.loginForm);
			}
		});
	};

	updateStatus = (manager: ServiceManager, status: LoginStatus): void => {
		this.node.classList.remove('loading');
		if (status == LoginStatus.SUCCESS) {
			this.node.classList.add('active');
		} else {
			this.node.classList.add('inactive');
			this.loginButton.classList.remove('hidden');
		}
		manager.updateServiceStatus(this.service.name, status);
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
	inactiveWarning: HTMLElement;

	constructor(node: HTMLElement) {
		this.node = node;
		this.addForm = DOM.create('div', {
			class: 'service add',
		});
		this.selector = DOM.create('select', {
			childs: [DOM.create('option', { textContent: 'Select Service' })],
		});
		this.noServices = document.getElementById('no-service') as HTMLElement;
		this.inactiveWarning = document.getElementById('inactive-service') as HTMLElement;
		this.createAddForm();
		this.updateAll();
	}

	addService = (serviceName: ServiceName): void => {
		const service = ServiceClass(serviceName);
		const serviceOptions = new ServiceOptions(service);
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
				this.inactiveWarning.classList.add('hidden');
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
					this.inactiveWarning.classList.add('hidden');
				}
			}
		} else if (status != LoginStatus.SUCCESS) {
			this.inactiveServices.push(name);
			this.inactiveWarning.classList.remove('hidden');
		}
	};

	updateAll = (): void => {
		// Remove previous
		for (const service of this.services) {
			service.node.remove();
		}
		this.services = [];
		this.inactiveServices = [];
		// Insert current Services
		for (const serviceName of Options.services) {
			this.addService(serviceName);
		}
		if (Options.services.length == 0) {
			this.noServices.classList.remove('hidden');
		}
	};
}

import { DOM, MessageType } from '../../Core/DOM';
import { Services } from '../../Core/Services';
import { Modal } from '../../Core/Modal';
import { Options } from '../../Core/Options';
import { ActivableKey, LoginMethod, Service } from '../../Core/Service';
import { SaveOptions } from '../Utility';
import { ModuleInterface } from '../../Core/ModuleInterface';
import { OptionsManager } from '../OptionsManager';

class ServiceCard {
	manager: ServiceManager;
	service: typeof Service;

	activeCard: HTMLElement;
	activeCardContent: HTMLElement;
	loadingMessage: HTMLElement;
	statusMessage: HTMLElement;
	statusMessageContent: HTMLElement;
	activateButton: HTMLButtonElement;
	mainMessage: HTMLElement;
	mainButton: HTMLButtonElement;
	checkStatusButton: HTMLButtonElement;
	loginButton: HTMLAnchorElement;
	removeButton: HTMLElement;
	importButton: HTMLButtonElement;
	exportButton: HTMLButtonElement;

	message(type: MessageType, content: string, append: boolean = true): HTMLElement {
		const message = DOM.create('div', {
			class: `message ${type}`,
			childs: [
				DOM.create('div', { class: 'icon' }),
				DOM.create('div', { class: 'content', childs: [DOM.create('p', { textContent: content })] }),
			],
		});
		DOM.message(type, content);
		if (append) DOM.append(this.activeCardContent, message);
		return message;
	}

	createCard(): HTMLElement {
		return DOM.create('div', {
			class: 'scs card',
			childs: [
				DOM.create('div', {
					class: `header ${this.service.key}`,
					childs: [this.service.createTitle()],
				}),
				DOM.create('div', { class: 'body' }),
			],
		});
	}

	constructor(manager: ServiceManager, service: typeof Service) {
		this.manager = manager;
		this.service = service;
		// Create
		this.activeCard = this.createCard();
		this.activeCardContent = this.activeCard.lastElementChild as HTMLElement;
		// Messages
		this.loadingMessage = this.message('loading', 'Loading...');
		this.mainMessage = this.message('default', 'Main Service', false);
		this.statusMessage = this.message('default', 'Loading...', false);
		this.statusMessageContent = this.statusMessage.querySelector('.content > p') as HTMLElement;
		// Buttons
		this.activateButton = DOM.create('button', {
			class: 'primary',
			title: 'Activate',
			childs: [DOM.icon('plus'), DOM.text('Activate')],
		});
		this.mainButton = DOM.create('button', {
			class: 'primary',
			title: 'Set as Main',
			childs: [DOM.icon('angle-double-left'), DOM.text('Set as Main')],
		});
		this.checkStatusButton = DOM.create('button', {
			title: 'Refresh',
			childs: [DOM.icon('sync'), DOM.text('Refresh')],
		});
		this.loginButton = DOM.create('a', {
			class: 'button primary',
			title: 'Login',
			target: '_blank',
			childs: [DOM.icon('external-link-alt'), DOM.text('Login')],
		});
		this.removeButton = DOM.create('button', {
			childs: [DOM.icon('trash'), DOM.text('Remove')],
		});
		// Import/Export
		this.importButton = DOM.create('button', {
			childs: [DOM.icon('download'), DOM.text('Import')],
		});
		this.exportButton = DOM.create('button', {
			childs: [DOM.icon('upload'), DOM.text('Export')],
		});
		this.bind();
	}

	loading = (): void => {
		DOM.clear(this.activeCardContent);
		if (Options.mainService == this.service.key) {
			DOM.append(this.activeCardContent, this.mainMessage);
		}
		DOM.append(
			this.activeCardContent,
			this.loadingMessage,
			this.removeButton,
			DOM.create('hr'),
			this.importButton,
			this.exportButton
		);
	};

	activate = (): void => {
		this.activeCard.classList.add('active');
		DOM.clear(this.activeCardContent);
		if (Options.mainService == this.service.key) {
			DOM.append(this.activeCardContent, this.mainMessage);
		} else {
			DOM.append(this.activeCardContent, this.mainButton);
		}
		DOM.append(
			this.activeCardContent,
			this.statusMessage,
			this.loginButton,
			this.checkStatusButton,
			this.removeButton,
			DOM.create('hr'),
			this.importButton,
			this.exportButton
		);
	};

	desactivate = (): void => {
		this.activeCard.classList.remove('active');
		DOM.clear(this.activeCardContent);
		DOM.append(this.activeCardContent, this.activateButton, DOM.create('hr'), this.importButton, this.exportButton);
	};

	makeMain = (): void => {
		this.manager.mainService = this.service;
		this.manager.mainCard = this;
		this.mainButton.remove();
		this.activeCardContent.insertBefore(this.mainMessage, this.activeCardContent.firstElementChild);
		// Move the card to the first position
		this.manager.activeContainer.insertBefore(this.activeCard, this.manager.activeContainer.firstElementChild);
	};

	bind = (): void => {
		if (this.service.loginUrl !== undefined) {
			this.loginButton.href = this.service.loginUrl;
		}
		this.activateButton.addEventListener('click', async () => {
			Options.services.push(this.service.key);
			if (Options.services.length == 1) {
				Options.mainService = this.service.key;
				const containerFirstChild = this.manager.activeContainer.firstElementChild;
				if (this.activeCard != containerFirstChild) {
					this.manager.activeContainer.insertBefore(this.activeCard, containerFirstChild);
				}
			} else {
				let activeCards = this.manager.activeContainer.querySelectorAll('.card.active');
				this.manager.activeContainer.insertBefore(
					this.activeCard,
					activeCards[activeCards.length - 1].nextElementSibling
				);
			}
			SaveOptions();
			this.manager.reloadCard(this.service.key);
		});
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = Options.services.indexOf(this.service.key);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.service.key;
			SaveOptions();
			// Update old card
			if (this.manager.mainService && this.manager.mainCard) {
				const oldMainContent = this.manager.mainCard.activeCardContent;
				oldMainContent.insertBefore(this.manager.mainCard.mainButton, oldMainContent.firstElementChild);
				this.manager.mainCard.mainMessage.remove();
			}
			this.makeMain();
		});
		let busy = false;
		this.checkStatusButton.addEventListener('click', async () => {
			if (!busy) {
				busy = true;
				this.checkStatusButton.disabled = true;
				this.loginButton.remove();
				this.activeCardContent.insertBefore(this.loadingMessage, this.statusMessage);
				this.statusMessage.remove();
				// If it's an external login, we don't have the tokens saved outside of this page
				if (this.service.loginMethod == LoginMethod.EXTERNAL) {
					await Options.reloadTokens();
				}
				const status = await this.service.loggedIn();
				this.checkStatusButton.disabled = false;
				this.updateStatus(status);
				this.loadingMessage.remove();
				busy = false;
			}
		});
		this.removeButton.addEventListener('click', async () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.service.key);
			if (index > -1) {
				Options.services.splice(index, 1);
				if (Options.mainService == this.service.key) {
					Options.mainService = Options.services.length > 0 ? Options.services[0] : undefined;
				}
			}
			// Execute logout actions
			if (this.service.logout !== undefined) {
				await this.service.logout();
			}
			SaveOptions();
			// Disable card
			this.manager.removeActiveService(this.service.key);
			this.desactivate();
			// Move service card after the active cards
			while (
				this.activeCard.nextElementSibling &&
				this.activeCard.nextElementSibling.classList.contains('active')
			) {
				this.manager.activeContainer.insertBefore(
					this.activeCard,
					this.activeCard.nextElementSibling.nextElementSibling
				);
			}
			// Set the new main
			if (Options.mainService) {
				this.manager.cards[Options.mainService].makeMain();
			} else {
				this.manager.mainService = undefined;
				this.manager.mainCard = undefined;
			}
		});
		this.loginButton.addEventListener('click', (event) => {
			if (this.service.loginMethod == LoginMethod.FORM) {
				event.preventDefault();
				if (!this) return;
				// Create modal
				const modal = new Modal('small');
				modal.header.classList.add(this.service.key);
				modal.header.appendChild(this.service.createTitle());
				const submitButton = DOM.create('button', {
					class: 'primary puffy',
					type: 'submit',
					childs: [DOM.icon('sign-in-alt'), DOM.text('Login')],
				});
				submitButton.setAttribute('form', `login_${this.service.key}`);
				const cancelButton = DOM.create('button', {
					class: 'default center',
					childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
					type: 'submit',
				});
				const realSubmit = DOM.create('button', {
					type: 'submit',
					css: { display: 'none' },
				});
				const form = DOM.create('form', {
					class: 'body',
					name: `login_${this.service.key}`,
					childs: [
						DOM.create('div', {
							class: 'row-parameter',
							childs: [
								DOM.create('label', { textContent: this.service.identifierField[0] }),
								DOM.create('input', {
									type: this.service.identifierField[1],
									name: 'identifier',
									placeholder: this.service.identifierField[0],
									required: true,
								}),
								DOM.create('label', { textContent: 'Password' }),
								DOM.create('input', {
									type: 'password',
									name: 'password',
									placeholder: 'Password',
									required: true,
								}),
							],
						}),
						realSubmit,
					],
				});
				DOM.append(modal.body, form);
				DOM.append(modal.footer, submitButton, cancelButton);
				// Bind
				let busy = false;
				form.addEventListener('submit', async (event) => {
					event.preventDefault();
					if (!this) {
						modal.remove();
						return;
					}
					if (!busy && this.service.login) {
						busy = true;
						submitButton.disabled = true;
						cancelButton.disabled = true;
						modal.disableExit();
						modal.wrapper.classList.add('loading');
						// Login call Options.save itself
						const identifier = form.identifier.value.trim();
						const password = form.password.value;
						const res = await this.service.login(identifier, password);
						submitButton.disabled = false;
						cancelButton.disabled = false;
						modal.enableExit();
						modal.wrapper.classList.remove('loading');
						if (res == RequestStatus.SUCCESS) {
							SaveOptions();
							SimpleNotification.success({ text: `Logged in on **${this.service.serviceName}** !` });
							this.loginButton.remove();
							this.updateStatus(res);
							modal.remove();
							return;
						} else if (identifier == '' || password == '') {
							SimpleNotification.error({ text: `Empty ${this.service.identifierField[0]} or password.` });
						} else SimpleNotification.error({ text: 'Invalid credentials.' });
						busy = false;
					}
				});
				submitButton.addEventListener('click', (event) => {
					event.preventDefault();
					realSubmit.click();
				});
				cancelButton.addEventListener('click', (event) => {
					event.preventDefault();
					if (!busy) modal.remove();
				});
				modal.show();
			} // else LoginMethod.EXTERNAL just open a link
		});
		this.importButton.addEventListener('click', async (event) => {
			event.preventDefault();
			const moduleInterface = new ModuleInterface(this.service);
			const importModule = this.service.importModule(moduleInterface);
			importModule.postExecute = () => OptionsManager.instance.saveViewer.updateAll(true);
			moduleInterface.modal.show();
		});
		this.exportButton.addEventListener('click', (event) => {
			event.preventDefault();
			const moduleInterface = new ModuleInterface(this.service);
			const exportModule = this.service.exportModule(moduleInterface);
			exportModule.postExecute = () => OptionsManager.instance.saveViewer.updateAll(true);
			moduleInterface.modal.show();
		});
	};

	updateStatus = (status: RequestStatus): void => {
		// Avoid updating card if the Service has been removed while updating status
		if (this.activeCard.classList.contains('active')) {
			this.activate();
			if (status == RequestStatus.SUCCESS) {
				this.statusMessage.className = 'message success';
				this.statusMessageContent.textContent = 'Active';
				this.loginButton.remove();
			} else {
				this.statusMessage.className = 'message warning';
				this.statusMessageContent.textContent = 'Inactive';
				this.activeCardContent.insertBefore(this.loginButton, this.checkStatusButton);
			}
			this.manager.updateServiceStatus(this.service.key, status);
		}
	};
}

export class ServiceManager {
	// Active
	activeContainer: HTMLElement;
	noServices: HTMLElement;
	activeServices: ActivableKey[] = [];
	inactiveServices: ActivableKey[] = [];
	inactiveWarning: HTMLElement;
	mainService?: Service;
	mainCard?: ServiceCard;
	cards = {} as { [key in ActivableKey]: ServiceCard };

	constructor() {
		this.activeContainer = document.getElementById('service-list')!;
		// Warnings
		this.noServices = document.getElementById('no-service')!;
		this.inactiveWarning = document.getElementById('inactive-service')!;
		// Create Services and bind them
		for (const key of Object.values(ActivableKey)) {
			const card = new ServiceCard(this, Services[key]);
			this.activeContainer.appendChild(card.activeCard);
			this.cards[key] = card;
		}
		// Default State
		this.refreshActive();
	}

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
		this.mainService = undefined;
		this.mainCard = undefined;
		this.activeServices = [];
		this.inactiveServices = [];
		this.noServices.classList.add('hidden');
		this.inactiveWarning.classList.add('hidden');
		// Reload all Service cards
		for (const key of Object.values(ActivableKey)) {
			this.reloadCard(key);
			if (Options.mainService == key) {
				this.mainService = Services[key];
				this.mainCard = this.cards[key];
			}
		}
		if (this.activeServices.length == 0) {
			this.noServices.classList.remove('hidden');
		} else {
			this.noServices.classList.add('hidden');
		}
	};

	/**
	 * Activate or desactivate all buttons in a Service card.
	 * Check if the user is logged in on the Service and calls updateStatus to display warnings.
	 */
	reloadCard = async (key: ActivableKey): Promise<void> => {
		const card = this.cards[key];
		const index = Options.services.indexOf(key);
		if (Options.mainService == key) {
			this.mainService = Services[key];
			this.mainCard = card;
			this.activeContainer.insertBefore(this.mainCard.activeCard, this.activeContainer.firstElementChild);
			this.mainCard.activeCard.classList.add('active');
			this.addActiveService(key);
		} else if (index >= 0) {
			// Insert as the *index* child to follow the Options order
			const activeCards = this.activeContainer.querySelectorAll('.card.active');
			const length = activeCards.length;
			if (length == 0) {
				this.activeContainer.insertBefore(card.activeCard, this.activeContainer.firstElementChild);
			} else if (index >= length) {
				this.activeContainer.insertBefore(card.activeCard, activeCards[length - 1].nextElementSibling);
			} else if (index < length) {
				this.activeContainer.insertBefore(card.activeCard, activeCards[index]);
			}
			card.activeCard.classList.add('active');
			this.addActiveService(key);
		} else {
			this.activeContainer.appendChild(card.activeCard);
		}
		// Update displayed state (buttons)
		if (index >= 0) {
			card.loading();
			const status = await Services[key].loggedIn();
			card.updateStatus(status);
		} else {
			card.desactivate();
		}
	};
}

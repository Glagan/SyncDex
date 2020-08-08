import { DOM, AppendableElement } from '../../Core/DOM';
import { ServiceManager } from '../Manager/Service';
import { Options, AvailableOptions } from '../../Core/Options';
import {
	TitleCollection,
	ServiceName,
	ServiceKey,
	ServiceKeyType,
	ActivableKey,
	ActivableName,
	Title,
} from '../../Core/Title';
import { Mochi } from '../../Core/Mochi';
import { Modal } from '../Modal';
import { ImportableModule } from './Import';
import { ExportableModule } from './Export';
import { SaveOptions } from '../Utility';

export const enum LoginMethod {
	EXTERNAL,
	FORM,
}

/**
 * Convert a duration in ms to a string
 */
export function duration(time: number): string {
	if (time == 0) return '0s';
	const diff = Math.floor(time) / 1000;
	let r = [];
	let p: Partial<Record<'hours' | 'mins' | 'sec', number>> = {};
	if ((p.hours = Math.floor((diff % 86400) / 3600)) > 0) r.push(p.hours, `hour${p.hours > 1 ? 's' : ''} `);
	if ((p.mins = Math.floor((diff % 3600) / 60)) > 0) r.push(p.mins, `minute${p.mins > 1 ? 's' : ''} `);
	if ((p.sec = Math.floor(diff % 60)) > 0) r.push(p.sec, 's ');
	return r.join('').trim();
}

export class Summary {
	total: number = 0;
	valid: number = 0;
	failed: string[] = [];
	startTime: number = 0;

	start = (): void => {
		this.startTime = Date.now();
	};

	totalTime = (): string => {
		return duration(Date.now() - this.startTime);
	};
}

export class Checkbox {
	static make(name: string, labelContent: string, parent?: HTMLElement): HTMLElement {
		const checkbox = DOM.create('input', {
			type: 'checkbox',
			id: `ck_${name}`,
			name: name,
			checked: true,
		});
		const label = DOM.create('label', { textContent: labelContent, htmlFor: `ck_${name}` });
		if (parent) {
			return DOM.append(parent, checkbox, label);
		}
		return DOM.create('div', {
			class: 'parameter',
			childs: [checkbox, label],
		});
	}
}

export abstract class Service {
	static readonly serviceName: ServiceName;
	static readonly key: ServiceKey;
	manager: ServiceManager;

	loginModule?: LoginModule;
	activeModule?: ActivableModule;
	importModule?: ImportableModule;
	exportModule?: ExportableModule;

	/**
	 * Get a list of input elements used in the Save Viewer.
	 */
	static SaveInput(value?: ServiceKeyType): HTMLInputElement[] {
		const serviceName = (<typeof Service>this.prototype.constructor).serviceName;
		return [
			DOM.create('input', {
				type: 'number',
				name: serviceName,
				placeholder: `${serviceName} ID`,
				value: `${value ? value : ''}`,
			}),
		];
	}

	/**
	 * Handle Inputs created from SaveInput to update Title.services.
	 */
	static HandleInput(title: Title, form: HTMLFormElement): void {
		const serviceName = (<typeof Service>this.prototype.constructor).serviceName;
		const key = (<typeof Service>this.prototype.constructor).key as ActivableKey;
		if (form[serviceName].value != '') {
			const id = parseInt(form[serviceName].value as string);
			if (!isNaN(id)) (title.services[key] as number) = id;
		} else delete title.services[key];
	}

	/**
	 * Return a link to the Media identified by id on the Service.
	 */
	static link(id: ServiceKeyType): string {
		return '#';
	}

	constructor(manager: ServiceManager) {
		this.manager = manager;
	}

	get key(): ServiceKey {
		return (<typeof Service>this.constructor).key;
	}

	get serviceName(): ServiceName {
		return (<typeof Service>this.constructor).serviceName;
	}

	createCard = (withContent: boolean): HTMLElement => {
		const card = DOM.create('div', {
			class: 'card',
		});
		const header = DOM.create('div', {
			class: `header ${this.serviceName.toLowerCase()}`,
			childs: [this.createTitle()],
		});
		DOM.append(card, header);
		if (withContent) {
			const content = DOM.create('div', {
				class: 'content',
			});
			DOM.append(card, content);
		}
		return card;
	};

	createTitle = (): AppendableElement => {
		return DOM.text(this.serviceName);
	};
}

type MessageType = 'default' | 'loading' | 'warning' | 'success';

export abstract class LoginModule {
	abstract loggedIn(): Promise<RequestStatus>;
	login?(username: string, password: string): Promise<RequestStatus>;
	logout?(): Promise<void>;
}

export abstract class ActivableService extends Service {
	static readonly serviceName: ActivableName;
	static readonly key: ActivableKey;

	abstract loginModule: LoginModule;
	abstract activeModule: ActivableModule;
}

export function isActivable(service: Service): service is ActivableService {
	return service.loginModule !== undefined && service.activeModule !== undefined;
}

export abstract class ActivableModule {
	service: ActivableService;
	loginMethod?: LoginMethod;
	loginUrl?: string;
	activeCard: HTMLElement;
	activeCardContent: HTMLElement;
	loadingMessage: HTMLElement;
	statusMessage: HTMLElement;
	statusMessageContent: HTMLElement;
	activateButton: HTMLButtonElement;
	mainMessage: HTMLElement;
	mainButton: HTMLButtonElement;
	checkStatusButton: HTMLElement;
	loginButton: HTMLAnchorElement;
	removeButton: HTMLElement;
	identifierField: [string, string] = ['Email', 'email'];
	preModalForm?(modal: Modal): void;

	message = (type: MessageType, content: string, append: boolean = true): HTMLElement => {
		const message = DOM.create('div', {
			class: `message ${type}`,
			childs: [
				DOM.create('div', { class: 'icon' }),
				DOM.create('div', { class: 'content', childs: [DOM.create('p', { textContent: content })] }),
			],
		});
		if (append) {
			DOM.append(this.activeCardContent, message);
		}
		return message;
	};

	constructor(service: ActivableService) {
		this.service = service;
		// Create
		this.activeCard = this.service.createCard(true);
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
	}

	loading = (): void => {
		DOM.clear(this.activeCardContent);
		DOM.append(this.activeCardContent, this.loadingMessage);
	};

	activate = (main: boolean): void => {
		this.activeCard.classList.add('active');
		DOM.clear(this.activeCardContent);
		if (main) {
			DOM.append(this.activeCardContent, this.mainMessage);
		} else {
			DOM.append(this.activeCardContent, this.mainButton);
		}
		DOM.append(
			this.activeCardContent,
			this.statusMessage,
			this.loginButton,
			this.checkStatusButton,
			this.removeButton
		);
	};

	desactivate = (): void => {
		this.activeCard.classList.remove('active');
		DOM.clear(this.activeCardContent);
		DOM.append(this.activeCardContent, this.activateButton);
	};

	bind = (): void => {
		if (this.loginUrl !== undefined) {
			this.loginButton.href = this.loginUrl;
		}
		// Bind
		this.activateButton.addEventListener('click', async () => {
			Options.services.push(this.service.key as ActivableKey);
			if (Options.services.length == 1) {
				Options.mainService = this.service.key as ActivableKey;
				const containerFirstChild = this.service.manager.activeContainer.firstElementChild;
				if (this.activeCard != containerFirstChild) {
					this.service.manager.activeContainer.insertBefore(this.activeCard, containerFirstChild);
				}
			} else {
				let activeCards = this.service.manager.activeContainer.querySelectorAll('.card.active');
				this.service.manager.activeContainer.insertBefore(
					this.activeCard,
					activeCards[activeCards.length - 1].nextElementSibling
				);
			}
			SaveOptions();
			this.service.manager.reloadManager(this.service);
		});
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = Options.services.indexOf(this.service.key as ActivableKey);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.service.key as ActivableKey;
			SaveOptions();
			// Remove main button and add the main button to the previous main
			if (this.service.manager.mainService && this.service.manager.mainService.activeModule) {
				const oldMainContent = this.service.manager.mainService.activeModule.activeCardContent;
				oldMainContent.insertBefore(
					this.service.manager.mainService.activeModule.mainButton,
					oldMainContent.firstElementChild
				);
				this.service.manager.mainService.activeModule.mainMessage.remove();
			}
			this.service.manager.mainService = this.service;
			this.mainButton.remove();
			this.activeCardContent.insertBefore(this.mainMessage, this.activeCardContent.firstElementChild);
			// Move the card to the first position
			this.service.manager.activeContainer.insertBefore(
				this.activeCard,
				this.service.manager.activeContainer.firstElementChild
			);
		});
		let busy = false;
		this.checkStatusButton.addEventListener('click', async () => {
			if (!busy) {
				busy = true;
				this.loginButton.remove();
				this.activeCardContent.insertBefore(this.loadingMessage, this.statusMessage);
				this.statusMessage.remove();
				// If it's an external login, we don't have the tokens saved outside of this page
				if (this.loginMethod == LoginMethod.EXTERNAL) {
					await Options.reloadTokens();
				}
				const status = await this.service.loginModule.loggedIn();
				this.updateStatus(status);
				this.loadingMessage.remove();
				busy = false;
			}
		});
		this.removeButton.addEventListener('click', async () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.service.key as ActivableKey);
			if (index > -1) {
				Options.services.splice(index, 1);
				if (Options.mainService == this.service.key) {
					Options.mainService = Options.services.length > 0 ? Options.services[0] : undefined;
				}
			}
			// Execute logout actions
			if (this.service.loginModule.logout !== undefined) {
				await this.service.loginModule.logout();
			}
			// Save
			SaveOptions();
			// Disable card
			this.service.manager.removeActiveService(this.service.key as ActivableKey);
			this.desactivate();
			// Move service card after the active cards
			while (
				this.activeCard.nextElementSibling &&
				this.activeCard.nextElementSibling.classList.contains('active')
			) {
				this.service.manager.activeContainer.insertBefore(
					this.activeCard,
					this.activeCard.nextElementSibling.nextElementSibling
				);
			}
			// Set the new main
			if (Options.mainService) {
				const mainService = this.service.manager.services.find(
					(service: Service) => service.key == Options.mainService
				);
				if (mainService && mainService.activeModule) {
					mainService.activeModule.mainButton.classList.add('hidden');
					this.service.manager.mainService = mainService;
				}
			} else {
				this.service.manager.mainService = undefined;
			}
		});
		this.loginButton.addEventListener('click', (event) => {
			if (this.loginMethod == LoginMethod.FORM) {
				event.preventDefault();
				if (!this) return;
				// Create modal
				const modal = new Modal('small');
				modal.header.classList.add(this.service.serviceName.toLocaleLowerCase());
				modal.header.appendChild(this.service.createTitle());
				const submitButton = DOM.create('button', {
					class: 'primary puffy',
					type: 'submit',
					childs: [DOM.icon('sign-in-alt'), DOM.text('Login')],
				});
				const cancelButton = DOM.create('button', {
					class: 'default center',
					childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
				});
				const form = DOM.create('form', {
					class: 'body',
					childs: [
						DOM.create('div', {
							class: 'row-parameter',
							childs: [
								DOM.create('label', { textContent: this.identifierField[0] }),
								DOM.create('input', {
									type: this.identifierField[1],
									name: 'identifier',
									placeholder: this.identifierField[0],
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
						submitButton,
						cancelButton,
					],
				});
				if (this.preModalForm) this.preModalForm(modal);
				DOM.append(modal.body, DOM.append(form, cancelButton));
				// Bind
				let busy = false;
				form.addEventListener('submit', async (event) => {
					event.preventDefault();
					if (!this) {
						modal.remove();
						return;
					}
					if (!busy && this.service.loginModule.login) {
						busy = true;
						submitButton.disabled = true;
						cancelButton.disabled = true;
						modal.disableExit();
						modal.content.classList.add('loading');
						// Login call Options.save itself
						const res = await this.service.loginModule.login(
							form.identifier.value.trim(),
							form.password.value
						);
						submitButton.disabled = false;
						cancelButton.disabled = false;
						modal.enableExit();
						modal.content.classList.remove('loading');
						if (res == RequestStatus.SUCCESS) {
							this.loginButton.remove();
							this.updateStatus(res);
							modal.remove();
							return;
						}
						busy = false;
					}
				});
				cancelButton.addEventListener('click', (event) => {
					event.preventDefault();
					if (!busy) modal.remove();
				});
				modal.show();
			} // else LoginMethod.EXTERNAL just open a link
		});
	};

	updateStatus = (status: RequestStatus): void => {
		this.activate(Options.mainService == this.service.key);
		if (status == RequestStatus.SUCCESS) {
			this.statusMessage.className = 'message success';
			this.statusMessageContent.textContent = 'Active';
			this.loginButton.remove();
		} else {
			this.statusMessage.className = 'message warning';
			this.statusMessageContent.textContent = 'Inactive';
			this.activeCardContent.insertBefore(this.loginButton, this.checkStatusButton);
		}
		this.service.manager.updateServiceStatus(this.service.key as ActivableKey, status);
	};
}

export abstract class SaveModule<T extends Summary = Summary> {
	card: HTMLElement;
	modal: Modal;
	service: Service;
	preForm?(): void;
	reset?(): void;
	postForm?(form: HTMLFormElement): void;
	abstract createForm(): HTMLFormElement;
	activeContainer?: HTMLElement;
	abstract handle(form: HTMLFormElement): Promise<void>;
	abstract cancel(): void;
	abstract summary: T;
	abstract displaySummary(): void;
	doStop: boolean = false;
	stopButton: HTMLButtonElement;
	closeButton: HTMLButtonElement;

	constructor(service: Service) {
		this.service = service;
		this.modal = this.createModal();
		this.stopButton = DOM.create('button', {
			class: 'danger',
			textContent: 'Cancel',
			events: {
				click: () => {
					this.doStop = true;
					this.stopButton.disabled = true;
				},
			},
			childs: [DOM.icon('times-circle')],
		});
		this.closeButton = DOM.create('button', {
			class: 'primary',
			textContent: 'Close',
			events: {
				click: () => {
					this.modal.remove();
				},
			},
			childs: [DOM.icon('times-circle')],
		});
		this.card = this.service.createCard(false);
		this.card.addEventListener('click', () => {
			this.resetModal();
			this.modal.show();
		});
	}

	checkLogin = async (): Promise<boolean> => {
		return (await this.service.loginModule?.loggedIn()) === RequestStatus.SUCCESS;
	};

	notification = (type: MessageType, content: string | AppendableElement[], parent?: HTMLElement): HTMLElement => {
		const messageContent = DOM.create('div', { class: 'content' });
		if (typeof content === 'string') {
			messageContent.appendChild(DOM.create('p', { textContent: content }));
		} else {
			DOM.append(messageContent, ...content);
		}
		let notification = DOM.create('div', {
			class: `message ${type}`,
			childs: [DOM.create('div', { class: 'icon' }), messageContent],
		});
		if (parent) {
			parent.appendChild(notification);
		} else if (this.activeContainer) {
			this.activeContainer.appendChild(notification);
		} else {
			this.modal.body.appendChild(notification);
		}
		return notification;
	};

	createModal = (): Modal => {
		const modal = new Modal();
		modal.modal.classList.add('ieport');
		modal.header.classList.add(this.service.serviceName.toLocaleLowerCase());
		modal.header.appendChild(this.service.createTitle());
		return modal;
	};

	resetModal = (): void => {
		DOM.clear(this.modal.body);
		this.stopButton.disabled = false;
		if (this.preForm) this.preForm();
		this.activeContainer = undefined;
		this.doStop = false;
		if (this.reset) this.reset();
		const form = this.createForm();
		form.addEventListener('animationend', (event) => {
			if (event.target == form && event.animationName == 'shrink') {
				form.remove();
				this.modal.disableExit();
				this.handle(form);
			}
		});
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			form.classList.toggle('closed');
		});
		const startButton = DOM.create('button', {
			class: 'primary puffy',
			textContent: 'Start',
			childs: [DOM.icon('play')],
		});
		const cancelButton = DOM.create('button', {
			class: 'default',
			childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
			events: {
				click: (event: Event): void => {
					event.preventDefault();
					this.modal.remove();
				},
			},
		});
		form.appendChild(DOM.create('div', { childs: [startButton, DOM.space(), cancelButton] }));
		this.modal.body.appendChild(form);
		if (this.postForm) this.postForm(form);
	};

	displayActive = (): void => {
		this.activeContainer = DOM.create('div');
		this.modal.body.appendChild(this.activeContainer);
		this.modal.body.appendChild(DOM.create('div', { class: 'leave right', childs: [this.stopButton] }));
		this.summary.start();
	};

	complete = (): void => {
		this.modal.enableExit();
		this.stopButton.replaceWith(this.closeButton);
	};

	/**
	 * Assign a value to the corresponding Option if it exists and it's the same type.
	 */
	assignValidOption = <K extends keyof AvailableOptions>(key: K, value: AvailableOptions[K]): number => {
		// Check if the value is the same type as the value in the Options
		if (typeof value === typeof Options[key]) {
			// Check if the key actually exist
			if ((Options as AvailableOptions)[key] !== undefined || key === 'mainService') {
				(Options as AvailableOptions)[key] = value;
				return 1;
			}
		}
		return 0;
	};

	mochiCheck = async (collection: TitleCollection): Promise<void> => {
		const progress = DOM.create('span', {
			textContent: 'Page 1 out of 1',
		});
		let notification = this.notification('loading', [
			DOM.create('p', { textContent: 'Checking Services with Mochi... ', childs: [progress] }),
		]);
		let offset = 0;
		let max = Math.ceil(collection.length / 250);
		for (let i = 0; !this.doStop && i < max; i++) {
			progress.textContent = `Page ${i + 1} out of ${max}`;
			const titleList = collection.collection.slice(offset, offset + 250);
			offset += 250;
			const connections = await Mochi.findMany(titleList.map((title) => title.id));
			if (connections !== undefined) {
				for (const titleId in connections) {
					const id = parseInt(titleId);
					const title = titleList.find((t) => t.id == id);
					if (title) Mochi.assign(title, connections[titleId]);
				}
			}
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
	};
}

import { DOM, AppendableElement } from '../../src/DOM';
import { ServiceManager } from '../Manager/Service';
import { Options, AvailableOptions } from '../../src/Options';
import { TitleCollection, Title, ServiceTitle, ServiceKey, ServiceName } from '../../src/Title';
import { LocalStorage } from '../../src/Storage';
import { Mochi } from '../../src/Mochi';
import { RequestStatus } from '../../src/Runtime';

export const enum LoginMethod {
	EXTERNAL,
	FORM,
}

export interface ImportState {
	current: number;
	max: number;
}

export const enum ImportStep {
	FETCH_PAGES,
	CONVERT_TITLES,
}

export class Summary {
	total: number = 0;
	valid: number = 0;
}

export class ImportSummary extends Summary {
	options: number = 0;
	history: boolean = false;
}

export type FileImportFormat = 'JSON' | 'XML';

export class Checkbox {
	static make(name: string, labelContent: string, parent?: HTMLElement): HTMLElement {
		const checkbox = DOM.create('div', {
			class: 'checkbox checked',
			attributes: { name: name },
			childs: [DOM.icon('check')],
		});
		const label = DOM.create('label', { textContent: labelContent });
		checkbox.addEventListener('click', (event) => {
			event.preventDefault();
			checkbox.classList.toggle('checked');
		});
		label.addEventListener('click', (event) => {
			event.preventDefault();
			checkbox.classList.toggle('checked');
		});
		if (parent) {
			return DOM.append(parent, checkbox, label);
		}
		return DOM.create('div', {
			class: 'parameter',
			childs: [checkbox, label],
		});
	}
}

export class Modal {
	modal: HTMLElement;
	content: HTMLElement;
	header: HTMLElement;
	body: HTMLElement;
	canExit: boolean = true;

	constructor(size?: 'small') {
		this.modal = DOM.create('div', {
			class: 'modal',
		});
		if (size) this.modal.classList.add(size);
		this.content = DOM.create('div', {
			class: 'card content',
		});
		this.header = DOM.create('div', {
			class: `header`,
		});
		this.body = DOM.create('div', {
			class: 'body content',
		});
		DOM.append(this.modal, DOM.append(this.content, this.header, this.body));
		// Bind
		this.modal.addEventListener('animationend', (event) => {
			// Remove the modal when the fade-out animation ends
			if (event.target == this.modal && event.animationName === 'fade-out') {
				this.modal.remove();
				this.modal.classList.remove('closed');
			}
		});
		this.modal.addEventListener('click', (event) => {
			if (this.canExit && event.target == this.modal) {
				event.preventDefault();
				this.modal.classList.add('closed');
			}
		});
	}

	show = (): void => {
		document.body.appendChild(this.modal);
	};

	remove = (): void => {
		this.modal.classList.add('closed');
	};

	enableExit = (): void => {
		this.canExit = true;
	};

	disableExit = (): void => {
		this.canExit = false;
	};
}

export abstract class Service {
	manager: ServiceManager;

	abstract key: ServiceKey;
	abstract name: ServiceName;
	abstract activeModule?: ActivableModule;
	abstract importModule?: ImportableModule;
	abstract exportModule?: ExportableModule;

	constructor(manager: ServiceManager) {
		this.manager = manager;
	}

	createCard = (withContent: boolean): HTMLElement => {
		const card = DOM.create('div', {
			class: 'card',
		});
		const header = DOM.create('div', {
			class: `header ${this.name.toLowerCase()}`,
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
		return DOM.text(this.name);
	};
}

export abstract class ActivableModule {
	service: Service;
	activable: boolean = true;
	loginMethod?: LoginMethod;
	loginUrl?: string;
	activeCard: HTMLElement;
	activeCardContent: HTMLElement;
	loadingMessage: HTMLElement;
	statusMessage: HTMLElement;
	activateButton: HTMLButtonElement;
	mainMessage: HTMLElement;
	mainButton: HTMLButtonElement;
	checkStatusButton: HTMLElement;
	loginButton: HTMLAnchorElement;
	removeButton: HTMLElement;
	abstract loggedIn(): Promise<RequestStatus>;
	abstract login?(username: string, password: string): Promise<RequestStatus>;
	abstract logout?(): Promise<void>;
	identifierField: [string, string] = ['Email', 'email'];
	preModalForm?(modal: Modal): void;

	message = (type: 'default' | 'warning' | 'success', content: string, append: boolean = true): HTMLElement => {
		const message = DOM.create('div', {
			class: `message ${type}`,
			textContent: content,
		});
		if (append) {
			DOM.append(this.activeCardContent, message);
		}
		return message;
	};

	constructor(service: Service) {
		this.service = service;
		// Create
		this.activeCard = this.service.createCard(true);
		this.activeCardContent = this.activeCard.lastElementChild as HTMLElement;
		// Messages
		this.loadingMessage = this.message('default', 'Loading...');
		this.loadingMessage.classList.add('loading');
		this.mainMessage = this.message('default', 'Main Service', false);
		this.statusMessage = this.message('default', 'Loading...', false);
		// Buttons
		this.activateButton = DOM.create('button', {
			class: 'primary',
			attributes: { title: 'Activate' },
			childs: [DOM.icon('plus'), DOM.text('Activate')],
		});
		this.mainButton = DOM.create('button', {
			class: 'primary',
			attributes: { title: 'Set as Main' },
			childs: [DOM.icon('angle-double-left'), DOM.text('Set as Main')],
		});
		this.checkStatusButton = DOM.create('button', {
			attributes: { title: 'Refresh' },
			childs: [DOM.icon('sync'), DOM.text('Refresh')],
		});
		this.loginButton = DOM.create('a', {
			class: 'button primary',
			attributes: {
				title: 'Login',
				rel: 'noreferrer noopener',
				target: '_blank',
			},
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
			Options.services.push(this.service.name);
			if (Options.services.length == 1) {
				Options.mainService = this.service.name;
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
			Options.save();
			this.service.manager.reloadManager(this.service);
		});
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = Options.services.indexOf(this.service.name);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.service.name;
			Options.save();
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
				const status = await this.loggedIn();
				this.updateStatus(status);
				this.loadingMessage.remove();
				busy = false;
			}
		});
		this.removeButton.addEventListener('click', async () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.service.name);
			if (index > -1) {
				Options.services.splice(index, 1);
				if (Options.mainService == this.service.name) {
					Options.mainService = Options.services.length > 0 ? Options.services[0] : undefined;
				}
			}
			// Execute logout actions
			if (this.logout !== undefined) {
				await this.logout();
			}
			// Save
			Options.save();
			// Disable card
			this.service.manager.removeActiveService(this.service.name);
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
					(service: Service) => service.name == Options.mainService
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
				modal.header.classList.add(this.service.name.toLocaleLowerCase());
				modal.header.appendChild(this.service.createTitle());
				const form = DOM.create('form', {
					class: 'body',
					childs: [
						DOM.create('div', {
							class: 'row-parameter',
							childs: [
								DOM.create('label', { textContent: this.identifierField[0] }),
								DOM.create('input', {
									attributes: {
										type: this.identifierField[1],
										name: 'identifier',
										placeholder: this.identifierField[0],
										required: 'true',
									},
								}),
								DOM.create('label', { textContent: 'Password' }),
								DOM.create('input', {
									attributes: {
										type: 'password',
										name: 'password',
										placeholder: 'Password',
										required: 'true',
									},
								}),
							],
						}),
						DOM.create('button', {
							class: 'primary puffy fill',
							attributes: {
								type: 'submit',
							},
							childs: [DOM.icon('sign-in-alt'), DOM.text('Login')],
						}),
					],
				});
				const cancelButton = DOM.create('button', {
					class: 'default center',
					childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
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
					if (!busy && this.login) {
						busy = true;
						modal.content.classList.add('loading');
						// Login call Options.save itself
						const res = await this.login(form.identifier.value.trim(), form.password.value);
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
					if (!busy) {
						modal.remove();
					}
				});
				modal.show();
			} // else LoginMethod.EXTERNAL just open a link
		});
	};

	updateStatus = (status: RequestStatus): void => {
		this.activate(Options.mainService == this.service.name);
		if (status == RequestStatus.SUCCESS) {
			this.statusMessage.className = 'message success';
			this.statusMessage.textContent = 'Active';
			this.loginButton.remove();
		} else {
			this.statusMessage.className = 'message warning';
			this.statusMessage.textContent = 'Inactive';
			this.activeCardContent.insertBefore(this.loginButton, this.checkStatusButton);
		}
		this.service.manager.updateServiceStatus(this.service.name, status);
	};
}

export abstract class SaveModule {
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
	// Display summary and button to go back to Service selection
	abstract displaySummary(summary: Summary): void;
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
			this.modal.show(); // TODO: Avoid modal in FileExport
		});
	}

	checkLogin = async (): Promise<boolean> => {
		return (await this.service.activeModule?.loggedIn()) === RequestStatus.SUCCESS;
	};

	notification = (
		type: 'default' | 'loading' | 'warning' | 'success',
		content: string | AppendableElement[],
		parent?: HTMLElement
	): HTMLElement => {
		let notification = DOM.create('div', {
			class: `message ${type}`,
		});
		if (typeof content === 'string') {
			notification.textContent = content;
		} else {
			DOM.append(notification, ...content);
		}
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
		modal.header.classList.add(this.service.name.toLocaleLowerCase());
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
		this.modal.body.appendChild(DOM.create('div', { class: 'right', childs: [this.stopButton] }));
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
}

export abstract class ImportableModule extends SaveModule {
	summary: ImportSummary = new ImportSummary();

	reset = (): void => {
		this.summary = new ImportSummary();
	};

	cancel = (forced = false): void => {
		this.notification(
			'warning',
			forced ? 'The import was cancelled, nothing was saved' : 'You cancelled the import, nothing was saved.'
		);
		this.complete();
	};

	mochiCheck = async (collection: TitleCollection): Promise<void> => {
		const progress = DOM.create('span', {
			textContent: 'Page 1 out of 1',
		});
		let notification = this.notification('loading', [
			DOM.text('Checking Services with Mochi...'),
			DOM.space(),
			progress,
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
					if (title && connections.hasOwnProperty(titleId)) {
						const connection = connections[titleId];
						for (const s in connection) {
							if (connection.hasOwnProperty(s)) {
								const service = s as ServiceName;
								title.services[ServiceKey[service] as ServiceKey] = connection[service];
							}
						}
					}
				}
			}
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
	};

	displaySummary = (): void => {
		// this.notification('success', `Done Importing ${this.service.name} !`);
		if (this.summary.total != this.summary.valid) {
			this.notification(
				'warning',
				`${
					this.summary.total - this.summary.valid
				} titles were not imported since they had invalid or missing properties.`
			);
		}
		let report = `Successfully imported ${this.summary.valid} titles`;
		if (this.summary.options > 0)
			report += `${this.summary.history ? ', ' : ' and '} ${this.summary.options} Options`;
		if (this.summary.history) report += ` and History`;
		report += ` !`;
		this.notification('success', report);
	};
}

export abstract class FileImportableModule<T extends Object | Document, R extends Object> extends ImportableModule {
	abstract fileType: FileImportFormat;
	abstract handleTitles(save: T | Document): Promise<R[]>;
	abstract convertTitles(titles: TitleCollection, titleList: R[]): Promise<number>;
	abstract handleOptions?(save: T | Document, summary: ImportSummary): void;
	abstract handleHistory?(save: T | Document, titles: TitleCollection, summary: ImportSummary): number[];
	perConvert: number = 250;

	acceptedFileType = (): string => {
		return 'application/json';
	};

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		const inputId = `file_${this.service.name}`;
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		const options = Checkbox.make('merge', 'Merge with current save');
		Checkbox.make('checkServices', 'Check Services ID with Mochi after Import', options);
		form.appendChild(options);
		form.appendChild(
			DOM.create('h2', {
				childs: [DOM.create('label', { class: '', textContent: 'Save File', attributes: { for: inputId } })],
			})
		);
		DOM.append(
			form,
			DOM.create('div', {
				class: 'row-parameter',
				childs: [
					DOM.create('input', {
						attributes: {
							name: 'save',
							id: inputId,
							type: 'file',
							required: 'true',
							accept: this.acceptedFileType(),
						},
					}),
				],
			})
		);
		return form;
	};

	// TODO: Notifications are after the body
	handle = async (form: HTMLFormElement): Promise<void> => {
		let notification: HTMLElement;
		if (!form.save || form.save.files.length < 1) {
			notification = this.notification('warning', 'No file !');
			return;
		}
		notification = this.notification('loading', 'Loading file...');
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result !== 'string') {
				if (notification) notification.classList.remove('loading');
				notification = this.notification('warning', 'Unknown error, wrong file type.');
				return;
			}
			let data: T | Document;
			try {
				if (this.fileType == 'JSON') {
					data = JSON.parse(reader.result) as T;
				} else {
					const parser: DOMParser = new DOMParser();
					data = parser.parseFromString(reader.result, 'application/xml');
				}
			} catch (error) {
				console.error(error);
				if (notification) notification.classList.remove('loading');
				notification = this.notification('warning', 'Invalid file !');
				return;
			}
			if (notification) notification.classList.remove('loading');
			const merge = form.querySelector(`.checkbox[name='merge'].checked`) !== null;
			const checkServices = form.querySelector(`.checkbox[name='checkServices'].checked`) !== null;
			this.import(data, merge, checkServices);
		};
		reader.readAsText(form.save.files[0]);
	};

	import = async (data: T | Document, merge: boolean, checkServices: boolean): Promise<void> => {
		this.displayActive();
		// Import everything first
		let notification = this.notification('loading', 'Importing Titles');
		const titles: R[] = await this.handleTitles(data);
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Abort if there is nothing
		this.summary.total = titles.length;
		if (this.summary.total == 0) {
			this.notification('success', 'No titles found !');
			return this.cancel(true);
		}
		// Convert Service titles to Title
		let collection = new TitleCollection();
		notification = this.notification('loading', '');
		let offset = 0;
		let max = titles.length / this.perConvert;
		let currentTitle = 0;
		for (let i = 0; !this.doStop && i < max; i++) {
			const titleList = titles.slice(offset, offset + this.perConvert);
			offset += this.perConvert;
			currentTitle = Math.min(this.summary.total, currentTitle + this.perConvert);
			notification.textContent = `Converting title ${currentTitle} out of ${this.summary.total}.`;
			const converted = await this.convertTitles(collection, titleList);
			this.summary.valid += converted;
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Handle options and history
		if (this.handleOptions) {
			notification = this.notification('default', 'Importing Options');
			this.handleOptions(data, this.summary);
		}
		let history: number[] = [];
		if (this.handleHistory) {
			notification = this.notification('default', 'Importing History');
			history = this.handleHistory(data, collection, this.summary);
		}
		// Merge
		if (!merge) {
			await LocalStorage.clear();
		} else {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		// Mochi
		if (checkServices) {
			await this.mochiCheck(collection);
			if (this.doStop) return;
		}
		// We're double checking and saving only at the end in case of abort
		notification = this.notification('loading', 'Saving...');
		collection.save();
		if (this.handleHistory && history.length > 0) {
			await LocalStorage.set('history', history);
		}
		await Options.save(); // Always save -- options are deleted in LocalStorage
		if (this.handleOptions) {
			this.service.manager.reloadOptions(); // TODO: Reload
		}
		notification.remove();
		this.displaySummary();
		this.complete();
	};
}

export abstract class APIImportableModule<T extends ServiceTitle<T>> extends ImportableModule {
	currentTitle: number = 0;
	state: ImportState = { current: 0, max: 1 };
	convertTitles?(titles: TitleCollection, titleList: T[]): Promise<number>;
	abstract handlePage(): Promise<T[] | false>;
	perConvert: number = 250;
	preMain?(): Promise<boolean>;

	reset = (): void => {
		this.currentTitle = 0;
		this.state = { current: 0, max: 1 };
		this.summary = new ImportSummary();
	};

	getNextPage = (): boolean => {
		if (this.state.current < this.state.max || this.state.current == 0) {
			this.state.current++;
			return true;
		}
		return false;
	};

	getProgress = (step: ImportStep, total?: number): string => {
		if (step == ImportStep.FETCH_PAGES) {
			return `Importing page ${this.state.current} out of ${this.state.max}.`;
		}
		// ImportStep.CONVERT_TITLES
		this.currentTitle = Math.min(total as number, this.currentTitle + this.perConvert);
		return `Converting title ${this.currentTitle} out of ${total}.`;
	};

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		const options = Checkbox.make('merge', 'Merge with current save');
		Checkbox.make('checkServices', 'Check Services ID with Mochi after Import', options);
		form.appendChild(options);
		return form;
	};

	handle = async (form: HTMLFormElement): Promise<void> => {
		const merge = form.querySelector(`.checkbox[name='merge'].checked`) !== null;
		const checkServices = form.querySelector(`.checkbox[name='checkServices'].checked`) !== null;
		this.displayActive();
		let notification: HTMLElement = this.notification('loading', 'Checking login status...');
		// Check login status
		if (!(await this.checkLogin())) {
			notification.classList.remove('loading');
			this.notification('warning', 'You are not logged in !');
			return this.cancel(true);
		}
		notification.classList.remove('loading');
		DOM.append(notification, DOM.space(), DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		let titles: T[] = [];
		if (this.preMain) {
			if (!(await this.preMain())) {
				return this.cancel(true);
			}
		}
		if (this.doStop) return this.cancel();
		notification = this.notification('loading', '');
		// Fetch each pages to get a list of titles in the Service format
		while (!this.doStop && this.getNextPage() !== false) {
			notification.textContent = this.getProgress(ImportStep.FETCH_PAGES);
			let tmp: T[] | false = await this.handlePage();
			if (tmp === false) {
				notification.classList.remove('loading');
				return this.cancel(true);
			}
			titles.push(...tmp);
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		this.summary.total = titles.length;
		if (this.summary.total == 0) {
			this.notification('success', 'No titles found !');
			return this.cancel(true);
		}
		this.notification('success', `Found a total of ${titles.length} Titles.`);
		// Find MangaDex IDs from ServiceTitle
		notification = this.notification('loading', '');
		let collection = new TitleCollection();
		let offset = 0;
		let max = Math.ceil(titles.length / this.perConvert);
		for (let i = 0; !this.doStop && i < max; i++) {
			const titleList = titles.slice(offset, offset + this.perConvert);
			offset += this.perConvert;
			notification.textContent = this.getProgress(ImportStep.CONVERT_TITLES, titles.length);
			if (this.convertTitles) {
				const converted = await this.convertTitles(collection, titleList);
				this.summary.valid += converted;
			} else {
				const connections = await Mochi.findMany(
					titleList.map((t) => t.id),
					this.service.name
				);
				if (connections !== undefined) {
					for (const key in connections) {
						if (connections.hasOwnProperty(key)) {
							const connection = connections[key];
							if (connection['MangaDex'] !== undefined) {
								const id = parseInt(key);
								const title = titleList.find((t) => t.id == id) as T;
								title.mangaDex = connection['MangaDex'];
								const convertedTitle = title.toTitle();
								if (convertedTitle) {
									collection.add(convertedTitle);
									this.summary.valid++;
								}
							}
						}
					}
				}
			}
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Merge
		if (!merge) {
			await LocalStorage.clear();
		} else {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		// Mochi
		if (checkServices) {
			await this.mochiCheck(collection);
			if (this.doStop) return;
		}
		// Done !
		notification = this.notification('loading', 'Saving...');
		await Options.save(); // Always save -- options are deleted in LocalStorage
		await collection.save();
		notification.remove();
		this.displaySummary();
		this.complete();
	};
}

export abstract class ExportableModule extends SaveModule {
	summary: Summary = new Summary();

	reset = (): void => {
		this.summary = new Summary();
	};

	// By default, select all titles with a Service key for the current service and a status
	selectTitles = async (): Promise<Title[]> => {
		return (await TitleCollection.get()).collection.filter((title) => {
			const id = title.services[this.service.key];
			return id !== undefined && id > 0 && title.status !== Status.NONE;
		});
	};

	cancel = (forced = false): void => {
		this.notification('warning', forced ? 'The export was cancelled' : 'You cancelled the export.');
		this.complete();
	};

	displaySummary = (): void => {
		// this.notification('success', `Done Importing ${this.service.name} !`);
		if (this.summary.total != this.summary.valid) {
			this.notification(
				'warning',
				`${
					this.summary.total - this.summary.valid
				} titles were not exported since they had invalid or missing properties.`
			);
		}
		let report = `Successfully exported ${this.summary.valid} titles`;
		report += ` !`;
		this.notification('success', report);
	};
}

export abstract class FileExportableModule extends ExportableModule {
	abstract fileContent(): Promise<string>;

	createForm = (): HTMLFormElement => {
		return DOM.create('form', { class: 'body' });
	};

	handle = async (_form: HTMLFormElement): Promise<void> => {
		this.displayActive();
		let notification = this.notification('loading', 'Creating file...');
		let save = await this.fileContent();
		DOM.append(notification, DOM.space(), DOM.text('done !'));
		const blob = new Blob([save], { type: 'application/json;charset=utf-8' });
		const href = URL.createObjectURL(blob);
		notification.classList.remove('loading');
		if (save === '') {
			this.notification('warning', `There was an error while creating your file.`);
			return this.cancel(true);
		}
		let downloadLink = DOM.create('a', {
			style: {
				display: 'none',
			},
			attributes: {
				download: 'SyncDex.json',
				target: '_blank',
				href: href,
			},
		});
		document.body.appendChild(downloadLink);
		downloadLink.click();
		downloadLink.remove();
		URL.revokeObjectURL(href);
		this.notification('success', 'Save exported !');
		this.complete();
	};
}

export abstract class APIExportableModule extends ExportableModule {
	abstract exportTitle(title: Title): Promise<boolean>;
	preMain?(titles: Title[]): Promise<boolean>;

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		form.appendChild(Checkbox.make('checkServices', 'Check Services ID with Mochi before Export'));
		return form;
	};

	handle = async (form: HTMLFormElement): Promise<void> => {
		const checkServices = form.querySelector(`.checkbox[name='checkServices'].checked`) !== null;
		this.displayActive();
		// Check login status
		let notification: HTMLElement = this.notification('loading', 'Checking login status...');
		if (!(await this.checkLogin())) {
			notification.classList.remove('loading');
			this.notification('warning', 'You are not logged in !');
			return this.cancel(true);
		}
		notification.classList.remove('loading');
		DOM.append(notification, DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		// Check Services
		if (checkServices) {
			const progress = DOM.create('span', {
				textContent: 'Page 1 out of 1',
			});
			notification = this.notification('loading', [
				DOM.text('Checking Services with Mochi...'),
				DOM.space(),
				progress,
			]);
			const titles = await TitleCollection.get();
			const collection = titles.collection;
			let offset = 0;
			let max = Math.ceil(titles.length / 250);
			for (let i = 0; !this.doStop && i < max; i++) {
				progress.textContent = `Page ${i + 1} out of ${max}`;
				const titleList = collection.slice(offset, offset + 250);
				offset += 250;
				const connections = await Mochi.findMany(titleList.map((title) => title.id));
				if (connections !== undefined) {
					for (const titleId in connections) {
						const id = parseInt(titleId);
						const title = titleList.find((t) => t.id == id);
						if (title && connections.hasOwnProperty(titleId)) {
							const connection = connections[titleId];
							for (const s in connection) {
								if (connection.hasOwnProperty(s)) {
									const service = s as ServiceName;
									title.services[ServiceKey[service] as ServiceKey] = connection[service];
								}
							}
						}
					}
				}
			}
			await titles.save();
			notification.classList.remove('loading');
			if (this.doStop) return this.cancel();
		}
		// Select local titles
		notification = this.notification('loading', 'Loading Titles...');
		let titles = await this.selectTitles();
		notification.classList.remove('loading');
		if (titles.length == 0) {
			this.notification('default', `You don't have any Titles in your list that can be exported.`);
			return this.cancel(true);
		}
		this.summary.total = titles.length;
		if (this.preMain) {
			if (!(await this.preMain(titles))) {
				return this.cancel(true);
			}
		}
		if (this.doStop) return this.cancel();
		// Export one by one...
		notification = this.notification('loading', '');
		for (let i = 0; !this.doStop && i < this.summary.total; i++) {
			notification.textContent = `Exporting title ${i + 1} out of ${this.summary.total}.`;
			const title = titles[i];
			if (await this.exportTitle(title)) {
				this.summary.valid++;
			}
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Done
		this.displaySummary();
		this.complete();
	};
}

export abstract class BatchExportableModule<T> extends ExportableModule {
	abstract generateBatch(titles: Title[]): Promise<T>;
	abstract sendBatch(batch: T, summary: Summary): Promise<boolean>;

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		form.appendChild(Checkbox.make('checkServices', 'Check Services ID with Mochi before Export'));
		return form;
	};

	handle = async (form: HTMLFormElement): Promise<void> => {
		const checkServices = form.querySelector(`.checkbox[name='checkServices'].checked`) !== null;
		this.displayActive();
		// Check login status
		let notification: HTMLElement = this.notification('loading', 'Checking login status...');
		if (!(await this.checkLogin())) {
			notification.classList.remove('loading');
			this.notification('warning', 'You are not logged in !');
			return this.cancel(true);
		}
		notification.classList.remove('loading');
		DOM.append(notification, DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		// Check Services
		if (checkServices) {
			const progress = DOM.create('span', {
				textContent: 'Page 1 out of 1',
			});
			notification = this.notification('loading', [
				DOM.text('Checking Services with Mochi...'),
				DOM.space(),
				progress,
			]);
			const titles = await TitleCollection.get();
			const collection = titles.collection;
			let offset = 0;
			let max = Math.ceil(titles.length / 250);
			for (let i = 0; !this.doStop && i < max; i++) {
				progress.textContent = `Page ${i + 1} out of ${max}`;
				const titleList = collection.slice(offset, offset + 250);
				offset += 250;
				const connections = await Mochi.findMany(titleList.map((title) => title.id));
				if (connections !== undefined) {
					for (const titleId in connections) {
						const id = parseInt(titleId);
						const title = titleList.find((t) => t.id == id);
						if (title && connections.hasOwnProperty(titleId)) {
							const connection = connections[titleId];
							for (const s in connection) {
								if (connection.hasOwnProperty(s)) {
									const service = s as ServiceName;
									title.services[ServiceKey[service] as ServiceKey] = connection[service];
								}
							}
						}
					}
				}
			}
			await titles.save();
			notification.classList.remove('loading');
			if (this.doStop) return this.cancel();
		}
		// Select local titles
		notification = this.notification('loading', 'Loading Titles...');
		let titles = await this.selectTitles();
		notification.classList.remove('loading');
		if (titles.length == 0) {
			this.notification('default', `You don't have any Titles in your list that can be exported.`);
			return this.cancel(true);
		}
		// Generate batch
		this.summary.total = titles.length;
		notification = this.notification('loading', 'Generating batch');
		const batch = await this.generateBatch(titles);
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Export batch
		notification = this.notification('loading', 'Sending batch');
		const batchResult = await this.sendBatch(batch, this.summary);
		notification.classList.remove('loading');
		// Done
		if (batchResult === false) {
			this.notification('warning', 'There was an error while exporting the batch, maybe retry later');
			return this.cancel(true);
		}
		this.displaySummary();
		this.complete();
	};
}

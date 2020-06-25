import { DOM, AppendableElement } from '../../src/DOM';
import { ServiceManager } from '../Manager/Service';
import { Options, AvailableOptions } from '../../src/Options';
import { LoginStatus, Service, Status, ServiceName, ServiceKey } from '../../src/Service/Service';
import { TitleCollection, Title } from '../../src/Title';
import { LocalStorage } from '../../src/Storage';
import { Mochi } from '../../src/Mochi';

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

export class Row {
	node: HTMLElement;

	constructor(childs: AppendableElement[] = []) {
		this.node = DOM.create('div', { class: 'row' });
		if (childs.length > 0) {
			DOM.append(this.node, ...childs);
		}
	}
}

export class Checkbox extends Row {
	label: HTMLElement;
	input: HTMLInputElement;

	constructor(fieldName: string, label: string, checked: boolean = false) {
		super();
		this.label = DOM.create('label', {
			textContent: label,
		});
		this.input = DOM.create('input', {
			class: 'hidden',
			attributes: {
				name: fieldName,
				type: 'checkbox',
			},
		});
		let state = 'disabled';
		if (checked) {
			this.input.checked = true;
			state = 'enabled';
		}
		const checkbox = DOM.create('div', { class: `checkbox ${state}` });
		const enable = DOM.create('button', { class: 'on', textContent: 'Enable' });
		const disable = DOM.create('button', { class: 'off', textContent: 'Disable' });
		this.label.addEventListener('click', () => {
			if (this.input.checked) {
				checkbox.classList.remove('enabled');
				checkbox.classList.add('disabled');
				this.input.checked = false;
			} else {
				checkbox.classList.remove('disabled');
				checkbox.classList.add('enabled');
				this.input.checked = true;
			}
		});
		enable.addEventListener('click', (event) => {
			event.preventDefault();
			checkbox.classList.remove('disabled');
			checkbox.classList.add('enabled');
			this.input.checked = true;
		});
		disable.addEventListener('click', (event) => {
			event.preventDefault();
			checkbox.classList.remove('enabled');
			checkbox.classList.add('disabled');
			this.input.checked = false;
		});
		DOM.append(checkbox, enable, disable);
		DOM.append(this.node, this.label, this.input, checkbox);
	}
}

export class Input extends Row {
	label: HTMLElement;
	input: HTMLInputElement;

	constructor(fieldName: string, label: string, type: 'text' | 'number' = 'text') {
		super();
		this.label = DOM.create('label', {
			textContent: label,
			attributes: {
				for: `input_${type}_${fieldName}`,
			},
		});
		this.input = DOM.create('input', {
			attributes: {
				id: `input_${type}_${fieldName}`,
				name: fieldName,
				type: type,
			},
		});
		DOM.append(this.node, this.label, this.input);
	}
}

export class FileInput extends Row {
	label?: HTMLElement;
	input: HTMLInputElement;

	constructor(fieldName: string, label?: string, accept?: string) {
		super();
		if (label !== 'undefined') {
			this.label = DOM.create('label', {
				textContent: label,
				attributes: {
					for: `input_file_${fieldName}`,
				},
			});
			this.node.appendChild(this.label);
		}
		this.input = DOM.create('input', {
			class: 'button action',
			attributes: {
				name: fieldName,
				type: 'file',
				accept: accept ? accept : '*',
			},
		});
		DOM.append(this.node, this.input);
	}
}

interface Module {
	manager: ManageableService;
}

export abstract class ManageableService {
	manager: ServiceManager;
	abstract service: Service;
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
			class: `header ${this.service.name.toLowerCase()}`,
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
		return DOM.text(this.service.name);
	};
}

export abstract class ActivableModule {
	manager: ManageableService;
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
	abstract login?(username: string, password: string): Promise<LoginStatus>;
	abstract logout?(): Promise<void>;

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

	constructor(service: ManageableService) {
		this.manager = service;
		// Create
		this.activeCard = this.manager.createCard(true);
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
			childs: [DOM.icon('new-light'), DOM.text('Activate')],
		});
		this.mainButton = DOM.create('button', {
			class: 'primary',
			attributes: { title: 'Set as Main' },
			childs: [DOM.icon('underflow-light'), DOM.text('Set as Main')],
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
			childs: [DOM.icon('external-light'), DOM.text('Login')],
		});
		this.removeButton = DOM.create('button', {
			childs: [DOM.icon('delete'), DOM.text('Remove')],
		});
		this.bind();
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
			Options.services.push(this.manager.service.name);
			if (Options.services.length == 1) {
				Options.mainService = this.manager.service.name;
				const containerFirstChild = this.manager.manager.activeContainer.firstElementChild;
				if (this.activeCard != containerFirstChild) {
					this.manager.manager.activeContainer.insertBefore(this.activeCard, containerFirstChild);
				}
			} else {
				let activeCards = this.manager.manager.activeContainer.querySelectorAll('.card.active');
				this.manager.manager.activeContainer.insertBefore(
					this.activeCard,
					activeCards[activeCards.length - 1].nextElementSibling
				);
			}
			Options.save();
			this.manager.manager.reloadManager(this.manager);
		});
		this.mainButton.addEventListener('click', () => {
			// Make service the first in the list
			const index = Options.services.indexOf(this.manager.service.name);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.manager.service.name;
			Options.save();
			// Remove main button and add the main button to the previous main
			if (this.manager.manager.mainService && this.manager.manager.mainService.activeModule) {
				const oldMainContent = this.manager.manager.mainService.activeModule.activeCardContent;
				oldMainContent.insertBefore(
					this.manager.manager.mainService.activeModule.mainButton,
					oldMainContent.firstElementChild
				);
				this.manager.manager.mainService.activeModule.mainMessage.remove();
			}
			this.manager.manager.mainService = this.manager;
			this.mainButton.remove();
			this.activeCardContent.insertBefore(this.mainMessage, this.activeCardContent.firstElementChild);
			// Move the card to the first position
			this.manager.manager.activeContainer.insertBefore(
				this.activeCard,
				this.manager.manager.activeContainer.firstElementChild
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
				const status = await this.manager.service.loggedIn();
				this.updateStatus(status);
				this.loadingMessage.remove();
				busy = false;
			}
		});
		this.removeButton.addEventListener('click', async () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.manager.service.name);
			if (index > -1) {
				Options.services.splice(index, 1);
				if (Options.mainService == this.manager.service.name) {
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
			this.manager.manager.removeActiveService(this.manager.service.name);
			this.desactivate();
			// Move service card after the active cards
			while (
				this.activeCard.nextElementSibling &&
				this.activeCard.nextElementSibling.classList.contains('active')
			) {
				this.manager.manager.activeContainer.insertBefore(
					this.activeCard,
					this.activeCard.nextElementSibling.nextElementSibling
				);
			}
			// Set the new main
			if (Options.mainService) {
				const mainService = this.manager.manager.managers.find(
					(manager: ManageableService) => manager.service.name == Options.mainService
				);
				if (mainService && mainService.activeModule) {
					mainService.activeModule.mainButton.classList.add('hidden');
					this.manager.manager.mainService = mainService;
				}
			} else {
				this.manager.manager.mainService = undefined;
			}
		});
		this.loginButton.addEventListener('click', (event) => {
			if (this.loginMethod == LoginMethod.FORM) {
				event.preventDefault();
				if (!this) return;
				// Create modal
				const modal = DOM.create('div', {
					class: 'modal small',
				});
				const modalContent = DOM.create('div', {
					class: 'card content',
					childs: [
						DOM.create('div', {
							class: `header ${this.manager.service.name.toLocaleLowerCase()}`,
							childs: [this.manager.createTitle()],
						}),
					],
				});
				const form = DOM.create('form', {
					class: 'body content',
					childs: [
						DOM.create('label', { textContent: 'Email' }),
						DOM.create('input', {
							attributes: { type: 'text', name: 'email', placeholder: 'Email', required: 'true' },
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
						DOM.create('button', {
							class: 'primary puffy',
							attributes: {
								type: 'submit',
							},
							childs: [DOM.icon('login-light'), DOM.text('Login')],
						}),
					],
				});
				const cancelButton = DOM.create('button', {
					class: 'default center',
					childs: [DOM.icon('cancel'), DOM.text('Cancel')],
				});
				DOM.append(modal, DOM.append(modalContent, DOM.append(form, cancelButton)));
				// Bind
				let busy = false;
				modal.addEventListener('animationend', (event) => {
					// Remove the modal when the fade-out animation ends
					if (event.animationName === 'fade-out') {
						modal.remove();
					}
				});
				modal.addEventListener('click', (event) => {
					if (!busy && event.target == modal) {
						event.preventDefault();
						modal.classList.add('closed');
					}
				});
				form.addEventListener('submit', async (event) => {
					event.preventDefault();
					if (!this) {
						modal.classList.add('closed');
						return;
					}
					if (!busy && this.login) {
						busy = true;
						modalContent.classList.add('loading');
						// Login call Options.save itself
						const res = await this.login(form.email.value.trim(), form.password.value);
						modalContent.classList.remove('loading');
						if (res == LoginStatus.SUCCESS) {
							this.loginButton.remove();
							this.updateStatus(res);
							modal.classList.add('closed');
							return;
						}
						busy = false;
					}
				});
				cancelButton.addEventListener('click', (event) => {
					event.preventDefault();
					if (!busy) {
						modal.classList.add('closed');
					}
				});
				document.body.appendChild(modal);
			} // else LoginMethod.EXTERNAL just open a link
		});
	};

	updateStatus = (status: LoginStatus): void => {
		this.activate(Options.mainService == this.manager.service.name);
		if (status == LoginStatus.SUCCESS) {
			this.statusMessage.className = 'message success';
			this.statusMessage.textContent = 'Active';
			this.loginButton.remove();
		} else {
			this.statusMessage.className = 'message warning';
			this.statusMessage.textContent = 'Inactive';
			this.activeCardContent.insertBefore(this.loginButton, this.checkStatusButton);
		}
		this.manager.manager.updateServiceStatus(this.manager.service.name, status);
	};
}

export abstract class SaveModule implements Module {
	doStop: boolean = false;
	manager: ManageableService;
	abstract saveModuleHeader(): void;
	stopButton: HTMLElement;
	abstract mainHeader(): void;
	abstract cancel(): void;
	// Display summary and button to go back to Service selection
	abstract displaySummary(summary: Summary): void;

	constructor(service: ManageableService) {
		this.manager = service;
		this.stopButton = DOM.create('button', {
			class: 'danger',
			textContent: 'Cancel',
			events: {
				click: () => {
					this.doStop = true;
					this.stopButton.remove();
				},
			},
		});
	}

	checkLogin = async (): Promise<boolean> => {
		return (await this.manager.service.loggedIn()) === LoginStatus.SUCCESS;
	};

	notification = (type: string, content: string | AppendableElement[]): HTMLElement => {
		let notification = DOM.create('div', {
			class: `block notification ${type}`,
		});
		if (typeof content === 'string') {
			notification.textContent = content;
		} else {
			DOM.append(notification, ...content);
		}
		this.manager.manager.saveContainer.appendChild(notification);
		return notification;
	};

	resetButton = (content: string = 'Go back', type: string = 'action'): HTMLButtonElement => {
		return DOM.create('button', {
			class: type,
			textContent: content,
			events: {
				click: () => this.manager.manager.resetSaveContainer(),
			},
		});
	};

	createForm = (elements: (Row | AppendableElement)[], callback: (event: Event) => void): HTMLFormElement => {
		const form = DOM.create('form', { class: 'block' });
		for (const element of elements) {
			if (typeof element === 'object' && element instanceof Row) {
				form.appendChild(element.node);
			} else {
				form.appendChild(element);
			}
		}
		DOM.append(
			form,
			DOM.create('button', {
				class: 'success mr-1',
				textContent: 'Send',
				attributes: { type: 'submit' },
			}),
			this.resetButton('Cancel', 'danger')
		);
		form.addEventListener('submit', callback);
		return form;
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
	importCard: HTMLElement;
	abstract import(): Promise<void>;
	preForm?(): void;

	constructor(service: ManageableService) {
		super(service);
		this.importCard = this.manager.createCard(false);
		this.importCard.addEventListener('click', () => {
			this.mainHeader();
			this.import();
		});
	}

	saveModuleHeader = (): void => {
		this.manager.manager.fullHeader([DOM.icon('download'), DOM.text(' Import')]);
	};

	mainHeader = (): void => {
		this.manager.manager.clearSaveContainer();
		this.saveModuleHeader();
		this.manager.manager.header([
			DOM.create('img', { attributes: { src: `/icons/${this.manager.service.key}.png` } }),
			DOM.space(),
			DOM.text('Importing from '),
			this.manager.createTitle(),
		]);
	};

	cancel = (forced = false): void => {
		this.notification('warning', [
			DOM.text(
				forced ? 'The import was cancelled, nothing was saved' : 'You cancelled the import, nothing was saved.'
			),
			DOM.space(),
			this.resetButton(),
		]);
	};

	displaySummary = (summary: ImportSummary): void => {
		// this.notification('success', `Done Importing ${this.service.name} !`);
		if (summary.total != summary.valid) {
			this.manager.manager.saveContainer.appendChild(
				DOM.create('div', {
					class: 'block notification warning',
					textContent: `${
						summary.total - summary.valid
					} titles were not imported since they had invalid or missing properties.`,
				})
			);
		}
		let report = `Successfully imported ${summary.valid} titles`;
		if (summary.options > 0) report += `${summary.history ? ', ' : ' and '} ${summary.options} Options`;
		if (summary.history) report += ` and History`;
		report += ` !`;
		this.notification('success', [DOM.text(report), DOM.space(), this.resetButton()]);
	};
}

export abstract class FileImportableModule<T extends Object | Document, R extends Object> extends ImportableModule {
	abstract fileType: FileImportFormat;
	abstract handleTitles(save: T | Document): Promise<R[]>;
	abstract convertTitles(titles: TitleCollection, titleList: R[]): Promise<number>;
	abstract handleOptions?(save: T | Document, summary: ImportSummary): void;
	abstract handleHistory?(save: T | Document, titles: TitleCollection, summary: ImportSummary): number[];
	perConvert: number = 250;

	inputMessage = (): string => {
		return `${this.manager.service.name} save file`;
	};

	import = async (): Promise<void> => {
		this.notification('success', `Select your ${this.manager.service.name} save file.`);
		let notification: HTMLElement | undefined = undefined;
		const form = this.createForm(
			[
				new Checkbox('merge', 'Merge with current save', true),
				new FileInput(
					'file',
					this.inputMessage(),
					this.fileType == 'JSON' ? 'application/json' : 'application/xml'
				),
			],
			(event) => {
				event.preventDefault();
				if (notification) notification.remove();
				if (form.file.files.length < 1) {
					notification = this.notification('danger', 'No file !');
				}
				notification = this.notification('info loading', 'Loading file...');
				var reader = new FileReader();
				reader.onload = async (): Promise<void> => {
					if (typeof reader.result !== 'string') {
						if (notification) notification.remove();
						notification = this.notification('danger', 'Unknown error, wrong file type.');
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
						if (notification) notification.remove();
						notification = this.notification('danger', 'Invalid file !');
						return;
					}
					this.handleImport(data, form.merge.checked);
				};
				reader.readAsText(form.file.files[0]);
			}
		);
		if (this.preForm) this.preForm();
		DOM.append(this.manager.manager.saveContainer, form);
	};

	handleImport = async (data: T | Document, merge: boolean): Promise<void> => {
		this.manager.manager.clearSaveContainer();
		this.mainHeader();
		let summary = new ImportSummary();
		// Import everything first
		let progress = this.notification('info loading', [DOM.text('Importing Titles'), DOM.space(), this.stopButton]);
		const titles: R[] = await this.handleTitles(data);
		this.stopButton.remove();
		progress.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Abort if there is nothing
		summary.total = titles.length;
		if (summary.total == 0) {
			this.notification('success', 'No titles found !');
			return this.cancel(true);
		}
		// Convert Service titles to Title
		let collection = new TitleCollection();
		progress = this.notification('info loading', []);
		let offset = 0;
		let max = titles.length / this.perConvert;
		let currentTitle = 0;
		for (let i = 0; !this.doStop && i < max; i++) {
			const titleList = titles.slice(offset, offset + this.perConvert);
			offset += this.perConvert;
			currentTitle = Math.min(summary.total, currentTitle + this.perConvert);
			DOM.clear(progress);
			DOM.append(
				progress,
				DOM.text(`Converting title ${currentTitle} out of ${summary.total}.`),
				DOM.space(),
				this.stopButton
			);
			const converted = await this.convertTitles(collection, titleList);
			summary.valid += converted;
		}
		this.stopButton.remove();
		progress.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Handle options and history
		if (this.handleOptions) {
			progress = this.notification('info', 'Importing Options');
			this.handleOptions(data, summary);
		}
		let history: number[] = [];
		if (this.handleHistory) {
			progress = this.notification('info', 'Importing History');
			history = this.handleHistory(data, collection, summary);
		}
		// We're double checking and saving only at the end in case of abort
		progress = this.notification('info loading', 'Saving...');
		if (!merge) {
			await LocalStorage.clear();
		} else {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		collection.save();
		if (this.handleHistory && history.length > 0) {
			await LocalStorage.set('history', history);
		}
		await Options.save(); // Always save -- options are deleted in LocalStorage
		if (this.handleOptions) {
			this.manager.manager.reloadOptions(); // TODO: Reload
		}
		progress.remove();
		this.displaySummary(summary);
	};
}

export abstract class APIImportableModule<T> extends ImportableModule {
	currentTitle: number = 0;
	state: ImportState = { current: 0, max: 1 };
	abstract handlePage(): Promise<T[] | false>;
	abstract convertTitles(titles: TitleCollection, titleList: T[]): Promise<number>;
	perConvert: number = 250;
	preMain?(): Promise<boolean>;

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

	import = async (): Promise<void> => {
		const form = this.createForm([new Checkbox('merge', 'Merge with current save', true)], (event) => {
			event.preventDefault();
			this.handleImport(form.merge.checked);
		});
		if (this.preForm) this.preForm();
		DOM.append(this.manager.manager.saveContainer, form);
	};

	handleImport = async (merge: boolean): Promise<void> => {
		this.mainHeader();
		let progress: HTMLElement = this.notification('info loading', [
			DOM.text('Checking login status...'),
			DOM.space(),
			this.stopButton,
		]);
		// Check login status
		if (!(await this.checkLogin())) {
			this.stopButton.remove();
			progress.classList.remove('loading');
			this.notification('danger', 'You are not logged in !');
			return this.cancel(true);
		}
		this.stopButton.remove();
		progress.classList.remove('loading');
		DOM.append(progress, DOM.space(), DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		let titles: T[] = [];
		if (this.preMain) {
			if (!(await this.preMain())) {
				return this.cancel(true);
			}
		}
		if (this.doStop) return this.cancel();
		progress = this.notification('info loading', '');
		// Fetch each pages to get a list of titles in the Service format
		while (!this.doStop && this.getNextPage() !== false) {
			DOM.clear(progress);
			DOM.append(progress, DOM.text(this.getProgress(ImportStep.FETCH_PAGES)), DOM.space(), this.stopButton);
			let tmp: T[] | false = await this.handlePage();
			if (tmp === false) {
				this.stopButton.remove();
				progress.classList.remove('loading');
				return this.cancel(true);
			}
			titles.push(...tmp);
		}
		this.stopButton.remove();
		progress.classList.remove('loading');
		if (this.doStop) return this.cancel();
		let summary = new ImportSummary();
		summary.total = titles.length;
		if (summary.total == 0) {
			this.notification('success', 'No titles found !');
			return this.cancel(true);
		}
		this.notification('success', `Found a total of ${titles.length} Titles.`);
		// Convert the list to a TitleCollection
		progress = this.notification('info loading', '');
		let collection = new TitleCollection();
		let offset = 0;
		let max = Math.ceil(titles.length / this.perConvert);
		for (let i = 0; !this.doStop && i < max; i++) {
			const titleList = titles.slice(offset, offset + this.perConvert);
			offset += this.perConvert;
			DOM.clear(progress);
			DOM.append(
				progress,
				DOM.text(this.getProgress(ImportStep.CONVERT_TITLES, titles.length)),
				DOM.space(),
				this.stopButton
			);
			const converted = await this.convertTitles(collection, titleList);
			summary.valid += converted;
		}
		this.stopButton.remove();
		progress.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Done !
		progress = this.notification('info loading', 'Saving...');
		if (!merge) {
			await LocalStorage.clear();
		} else {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		await Options.save(); // Always save -- options are deleted in LocalStorage
		await collection.save();
		progress.remove();
		this.displaySummary(summary);
	};
}

export abstract class ExportableModule extends SaveModule {
	exportCard: HTMLElement;
	abstract export(): Promise<void>;
	preForm?(parent: HTMLElement): void;

	constructor(service: ManageableService) {
		super(service);
		this.exportCard = this.manager.createCard(false);
		this.exportCard.addEventListener('click', () => {
			this.mainHeader();
			this.export();
		});
	}

	saveModuleHeader = (): void => {
		this.manager.manager.fullHeader([DOM.icon('upload'), DOM.text(' Export')]);
	};

	mainHeader = (): void => {
		this.manager.manager.clearSaveContainer();
		this.saveModuleHeader();
		this.manager.manager.header([
			DOM.create('img', { attributes: { src: `/icons/${this.manager.service.key}.png` } }),
			DOM.space(),
			DOM.text('Exporting to '),
			this.manager.createTitle(),
		]);
	};

	// Default select all titles with a Service key for the current service and a status
	selectTitles = async (): Promise<Title[]> => {
		return (await TitleCollection.get()).collection.filter((title) => {
			const id = title.services[this.manager.service.key];
			return id !== undefined && id > 0 && title.status !== Status.NONE;
		});
	};

	cancel = (forced = false): void => {
		this.notification('warning', [
			DOM.text(forced ? 'The export was cancelled' : 'You cancelled the export.'),
			DOM.space(),
			this.resetButton(),
		]);
	};

	displaySummary = (summary: Summary): void => {
		// this.notification('success', `Done Importing ${this.service.name} !`);
		if (summary.total != summary.valid) {
			this.manager.manager.saveContainer.appendChild(
				DOM.create('div', {
					class: 'block notification warning',
					textContent: `${
						summary.total - summary.valid
					} titles were not exported since they had invalid or missing properties.`,
				})
			);
		}
		let report = `Successfully exported ${summary.valid} titles`;
		report += ` !`;
		this.notification('success', [DOM.text(report), DOM.space(), this.resetButton()]);
	};
}

export abstract class FileExportableModule extends ExportableModule {
	abstract fileContent(): Promise<string>;

	export = async (): Promise<void> => {
		let notification = this.notification('info loading', 'Creating file...');
		let save = await this.fileContent();
		DOM.append(notification, DOM.space(), DOM.text('done !'));
		const blob = new Blob([save], { type: 'application/json;charset=utf-8' });
		const href = URL.createObjectURL(blob);
		notification.classList.remove('loading');
		if (save === '') {
			this.notification('danger', `There was an error while creating your file.`);
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
		this.notification('success', [DOM.text('Save exported !'), DOM.space(), this.resetButton()]);
	};
}

export abstract class APIExportableModule extends ExportableModule {
	abstract exportTitle(title: Title): Promise<boolean>;
	preMain?(titles: Title[]): Promise<boolean>;

	export = async (): Promise<void> => {
		const block = DOM.create('div', {
			class: 'block',
		});
		const checkbox = new Checkbox('checkServices', 'Check Services ID with Mochi', true);
		const startButton = DOM.create('button', {
			class: 'success mr-1',
			textContent: 'Start',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					this.handleExport(checkbox.input.checked);
				},
			},
		});
		if (this.preForm) this.preForm(block);
		DOM.append(
			this.manager.manager.saveContainer,
			DOM.append(block, checkbox.node, startButton, this.resetButton())
		);
	};

	handleExport = async (checkServices: boolean): Promise<void> => {
		this.mainHeader();
		// Check login status
		let notification: HTMLElement = this.notification('info loading', [
			DOM.text('Checking login status...'),
			DOM.space(),
			this.stopButton,
		]);
		if (!(await this.checkLogin())) {
			this.stopButton.remove();
			notification.classList.remove('loading');
			this.notification('danger', 'You are not logged in !');
			return this.cancel(true);
		}
		this.stopButton.remove();
		notification.classList.remove('loading');
		DOM.append(notification, DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		// Check Services
		if (checkServices) {
			const progress = DOM.create('span', {
				textContent: 'Page 1 out of 1',
			});
			notification = this.notification('info loading', [
				DOM.text('Checking Services with Mochi...'),
				DOM.space(),
				progress,
				DOM.space(),
				this.stopButton,
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
			this.stopButton.remove();
			await titles.save();
			notification.classList.remove('loading');
			if (this.doStop) return this.cancel();
		}
		// Select local titles
		notification = this.notification('info loading', 'Loading Titles...');
		let titles = await this.selectTitles();
		notification.classList.remove('loading');
		if (titles.length == 0) {
			this.notification('info', `You don't have any Titles in your list that can be exported.`);
			return this.cancel(true);
		}
		let summary = new Summary();
		summary.total = titles.length;
		if (this.preMain) {
			if (!(await this.preMain(titles))) {
				return this.cancel(true);
			}
		}
		if (this.doStop) return this.cancel();
		// Export one by one...
		notification = this.notification('info loading', '');
		for (let i = 0; !this.doStop && i < summary.total; i++) {
			DOM.clear(notification);
			DOM.append(
				notification,
				DOM.text(`Exporting title ${i + 1} out of ${summary.total}.`),
				DOM.space(),
				this.stopButton
			);
			const title = titles[i];
			if (await this.exportTitle(title)) {
				summary.valid++;
			}
		}
		this.stopButton.remove();
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Done
		this.displaySummary(summary);
	};
}

export abstract class BatchExportableModule<T> extends ExportableModule {
	abstract generateBatch(titles: Title[]): Promise<T>;
	abstract sendBatch(batch: T, summary: Summary): Promise<boolean>;

	export = async (): Promise<void> => {
		const block = DOM.create('div', {
			class: 'block',
		});
		const checkbox = new Checkbox('checkServices', 'Check Services ID with Mochi', true);
		const startButton = DOM.create('button', {
			class: 'success mr-1',
			textContent: 'Start',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					this.handleExport(checkbox.input.checked);
				},
			},
		});
		if (this.preForm) this.preForm(block);
		DOM.append(
			this.manager.manager.saveContainer,
			DOM.append(block, checkbox.node, startButton, this.resetButton())
		);
	};

	handleExport = async (checkServices: boolean): Promise<void> => {
		this.mainHeader();
		// Check login status
		let notification: HTMLElement = this.notification('info loading', [
			DOM.text('Checking login status...'),
			DOM.space(),
			this.stopButton,
		]);
		if (!(await this.checkLogin())) {
			this.stopButton.remove();
			notification.classList.remove('loading');
			this.notification('danger', 'You are not logged in !');
			return this.cancel(true);
		}
		this.stopButton.remove();
		notification.classList.remove('loading');
		DOM.append(notification, DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		// Check Services
		if (checkServices) {
			const progress = DOM.create('span', {
				textContent: 'Page 1 out of 1',
			});
			notification = this.notification('info loading', [
				DOM.text('Checking Services with Mochi...'),
				DOM.space(),
				progress,
				DOM.space(),
				this.stopButton,
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
			this.stopButton.remove();
			await titles.save();
			notification.classList.remove('loading');
			if (this.doStop) return this.cancel();
		}
		// Select local titles
		notification = this.notification('info loading', 'Loading Titles...');
		let titles = await this.selectTitles();
		notification.classList.remove('loading');
		if (titles.length == 0) {
			this.notification('info', `You don't have any Titles in your list that can be exported.`);
			return this.cancel(true);
		}
		// Generate batch
		let summary = new Summary();
		summary.total = titles.length;
		notification = this.notification('info loading', 'Generating batch');
		const batch = await this.generateBatch(titles);
		this.stopButton.remove();
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Export batch
		notification = this.notification('info loading', 'Sending batch');
		const batchResult = await this.sendBatch(batch, summary);
		notification.classList.remove('loading');
		// Done
		if (batchResult === false) {
			this.notification('danger', 'There was an error while exporting the batch, maybe retry later');
			return this.cancel(true);
		}
		this.displaySummary(summary);
	};
}

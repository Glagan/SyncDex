import { DOM, AppendableElement } from '../../src/DOM';
import { ServiceName, ServiceManager } from '../Manager/Service';
import { Options, AvailableOptions } from '../../src/Options';
import { LoginStatus, LoginMethod } from '../../src/Service/Service';

export interface ImportState {
	current: number;
	max: number;
}

export interface ImportSummary {
	options: number;
	history: boolean;
	total: number;
	invalid: number;
}

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

	constructor(fieldName: string, label: string) {
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
		const checkbox = DOM.create('div', { class: 'checkbox disabled' });
		const enable = DOM.create('button', { class: 'on', textContent: 'Enable' });
		const disable = DOM.create('button', {
			class: 'off',
			textContent: 'Disable',
		});
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

interface ActiveOptions {
	node: HTMLElement;
	mainButton: HTMLElement;
	checkStatusButton: HTMLElement;
	loginButton: HTMLElement;
	loginForm?: HTMLFormElement;
	removeButton: HTMLElement;
}

export abstract class Service {
	manager: ServiceManager;
	abstract name: ServiceName;
	abstract key: string;
	abstract activable: boolean;
	loginMethod?: LoginMethod;
	loginUrl?: string;
	activeOptions?: ActiveOptions;
	abstract isLoggedIn?<T extends {}>(reference?: T): Promise<LoginStatus>;
	abstract login?(username: string, password: string): Promise<LoginStatus>;
	abstract logout?(): Promise<void>;

	abstract importable: boolean;
	abstract import?(): Promise<void>;
	importCard?: HTMLElement;
	abstract exportable: boolean;
	abstract export?(): Promise<void>;
	exportCard?: HTMLElement;

	constructor(manager: ServiceManager) {
		this.manager = manager;
	}

	// Active

	initActive = (): void => {
		// Create
		this.activeOptions = {} as ActiveOptions;
		this.activeOptions.node = this.createBlock();
		this.activeOptions.node.classList.add('loading');
		const buttons = DOM.create('div', { class: 'button-group' });
		this.activeOptions.mainButton = DOM.create('button', {
			class: 'default',
			attributes: { title: 'Set as main' },
			childs: [DOM.icon('angle-double-left')],
		});
		this.activeOptions.checkStatusButton = DOM.create('button', {
			class: 'action',
			attributes: { title: 'Check login status' },
			childs: [DOM.icon('reload')],
		});
		this.activeOptions.loginButton = DOM.create('a', {
			class: 'button success hidden',
			attributes: {
				title: 'Login',
				href: this.loginUrl || '',
				rel: 'noreferrer noopener',
				target: '_blank',
			},
			childs: [DOM.icon('link'), DOM.space(), DOM.text('Login')],
		});
		this.activeOptions.removeButton = DOM.create('button', {
			class: 'danger grow',
			childs: [DOM.icon('cross-circle'), DOM.space(), DOM.text('Remove')],
		});
		DOM.append(
			this.activeOptions.node,
			DOM.append(
				buttons,
				this.activeOptions.mainButton,
				this.activeOptions.loginButton,
				this.activeOptions.checkStatusButton,
				this.activeOptions.removeButton
			)
		);
		// Bind
		this.activeOptions.mainButton.addEventListener('click', () => {
			if (!this.activeOptions) return;
			// Make service the first in the list
			const index = Options.services.indexOf(this.name as any);
			this.manager.services.splice(0, 0, this.manager.services.splice(index, 1)[0]);
			Options.services.splice(0, 0, Options.services.splice(index, 1)[0]);
			Options.mainService = this.name as any;
			Options.save();
			// Remove main button and add the main button to the previous main
			if (this.manager.mainService) {
				this.manager.mainService.activeOptions?.mainButton.classList.remove('main');
				this.manager.mainService.activeOptions?.mainButton.classList.remove('hidden');
			}
			this.manager.mainService = this;
			this.activeOptions.mainButton.classList.add('hidden');
			this.activeOptions.node.classList.add('main');
			// Move the card to the first position
			this.activeOptions.node.parentElement?.insertBefore(
				this.activeOptions.node,
				this.activeOptions.node.parentElement.firstElementChild
			);
		});
		let busy = false;
		this.activeOptions.checkStatusButton.addEventListener('click', async () => {
			if (!busy && this.activeOptions) {
				busy = true;
				this.activeOptions.loginButton.classList.add('hidden');
				this.activeOptions.node.classList.remove('active', 'inactive');
				this.activeOptions.node.classList.add('loading');
				if (this.activeOptions.loginForm) {
					this.activeOptions.loginForm.remove();
					this.activeOptions.loginForm = undefined;
				}
				if (this.isLoggedIn) {
					const status = await this.isLoggedIn();
					this.updateStatus(status);
				}
				busy = false;
			}
		});
		this.activeOptions.removeButton.addEventListener('click', async () => {
			// Remove service from Service list and assign new main if possible
			const index = Options.services.indexOf(this.name as any);
			if (index > -1) {
				this.manager.services.splice(index, 1);
				Options.services.splice(index, 1);
				if (Options.mainService == this.name) {
					Options.mainService = Options.services.length > 0 ? Options.services[0] : undefined;
				}
			}
			// Execute logout actions
			if (this.logout !== undefined) {
				await this.logout();
			}
			// Save
			Options.save();
			// Remove service block and add the option back to the selector
			this.activeOptions?.node.remove();
			this.manager.addSelectorRow(this.name);
			// Set the new main
			if (Options.mainService) {
				this.manager.services[0].activeOptions?.node.classList.add('main');
				this.manager.services[0].activeOptions?.mainButton.classList.add('hidden');
				this.manager.mainService = this.manager.services[0];
			} else {
				this.manager.mainService = undefined;
			}
		});
		this.activeOptions.loginButton.addEventListener('click', (event) => {
			if (this.loginMethod == LoginMethod.FORM) {
				event.preventDefault();
				if (!this.activeOptions || this.activeOptions?.loginForm) return;
				this.activeOptions.loginForm = DOM.create('form', {
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
				this.activeOptions.loginForm.addEventListener('submit', async (event) => {
					event.preventDefault();
					if (this.activeOptions?.loginForm === undefined) return;
					if (!busy) {
						busy = true;
						this.activeOptions?.node.classList.add('loading');
						this.activeOptions?.loginForm.classList.add('hidden');
						if (this.login) {
							// Login call Options.save itself
							const res = await this.login(
								this.activeOptions?.loginForm.username.value.trim(),
								this.activeOptions?.loginForm.password.value
							);
							if (res == LoginStatus.SUCCESS) {
								this.activeOptions?.loginForm.remove();
								this.activeOptions.loginForm = undefined;
								this.activeOptions?.node.classList.remove('inactive', 'loading');
								this.activeOptions?.node.classList.add('active');
								this.activeOptions?.loginButton.classList.add('hidden');
								this.updateStatus(res);
								return;
							}
						}
						// If there was an error -- show the form again
						// TODO: Notification
						this.activeOptions?.loginForm.classList.remove('hidden');
						busy = false;
					}
				});
				this.activeOptions?.node.appendChild(this.activeOptions?.loginForm);
			}
		});
	};

	createBlock(): HTMLElement {
		let node = DOM.create('div', {
			class: `service ${this.name.toLowerCase()}`,
		});
		const title = DOM.create('span', {
			class: 'title',
			childs: [
				DOM.create('img', {
					attributes: { src: `/icons/${this.key}.png` },
				}),
				DOM.space(),
				this.createTitle(),
			],
		});
		return DOM.append(node, title);
	}

	createTitle(): HTMLElement {
		return DOM.create('span', {
			class: this.name.toLowerCase(),
			textContent: this.name,
		});
	}

	updateStatus = (status: LoginStatus): void => {
		this.activeOptions?.node.classList.remove('loading');
		if (status == LoginStatus.SUCCESS) {
			this.activeOptions?.node.classList.add('active');
		} else {
			this.activeOptions?.node.classList.add('inactive');
			this.activeOptions?.loginButton.classList.remove('hidden');
		}
		this.manager.updateServiceStatus(this.name, status);
	};

	// Import/Export

	initImport = (): void => {
		this.importCard = this.createBlock();
		this.importCard.addEventListener('click', () => {
			if (this.import) {
				this.manager.clearSaveContainer();
				this.manager.fullHeader([DOM.icon('download'), DOM.text(' Import')]);
				this.manager.header([
					DOM.create('img', { attributes: { src: `/icons/${this.key}.png` } }),
					DOM.space(),
					DOM.text(`Importing from ${this.name}`),
				]);
				this.import();
			}
		});
	};

	initExport = (): void => {
		this.exportCard = this.createBlock();
		this.exportCard.addEventListener('click', () => {
			if (this.export) {
				this.manager.clearSaveContainer();
				this.manager.fullHeader([DOM.icon('upload'), DOM.text(' Export')]);
				this.manager.header([
					DOM.create('img', { attributes: { src: `/icons/${this.key}.png` } }),
					DOM.space(),
					DOM.text(`Exporting to ${this.name}`),
				]);
				this.export();
			}
		});
	};

	title = (): HTMLElement => {
		return DOM.create('span', {
			class: this.name.toLowerCase(),
			textContent: this.name,
		});
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
		this.manager.saveContainer.appendChild(notification);
		return notification;
	};

	stopButton = (callback: () => void, content: string = 'Cancel'): HTMLButtonElement => {
		const stopButton = DOM.create('button', {
			class: 'danger',
			textContent: content,
			events: {
				click: () => {
					callback();
					stopButton.remove();
				},
			},
		});
		return stopButton;
	};

	resetButton = (content: string = 'Go back', type: string = 'action'): HTMLButtonElement => {
		return DOM.create('button', {
			class: type,
			textContent: content,
			events: {
				click: () => this.manager.resetSaveContainer(),
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
		DOM.append(this.manager.saveContainer, form);
		return form;
	};

	// ExtensionSave

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

	/**
	 * Display summary and button to go back to Service selection
	 */
	displaySummary = (summary: ImportSummary): void => {
		this.manager.resetSaveContainer();
		this.manager.header(`Done Importing ${this.name}`);
		if (summary.options == 0) {
			this.manager.saveContainer.appendChild(
				DOM.create('div', {
					class: 'block notification warning',
					textContent: 'Options were not imported since there was none.',
				})
			);
		}
		if (summary.invalid > 0) {
			this.manager.saveContainer.appendChild(
				DOM.create('div', {
					class: 'block notification warning',
					textContent: `${summary.invalid} (of ${summary.total}) titles were not imported since they had invalid properties.`,
				})
			);
		}
		this.notification('success', [
			DOM.text(
				`Successfully imported ${summary.total - summary.invalid} titles, ${
					summary.options
				} Options and History !`
			),
			DOM.space(),
			DOM.create('button', {
				class: 'action',
				textContent: 'Go Back',
				events: {
					click: () => this.manager.resetSaveContainer(),
				},
			}),
		]);
	};
}

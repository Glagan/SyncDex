import { DOM, AppendableElement } from '../../src/DOM';
import { Options } from '../../src/Options';

export abstract class ServiceSave {
	manager: SaveManager;
	error?: HTMLElement;
	success?: HTMLElement;
	abstract name: string;
	abstract key: string;

	constructor(manager: SaveManager) {
		this.manager = manager;
	}

	title = (): HTMLElement => {
		return DOM.create('span', {
			class: this.name.toLowerCase(),
			textContent: this.name,
		});
	};

	removeSuccess = (): void => {
		if (this.success) {
			this.success.remove();
			this.success = undefined;
		}
	};

	displaySuccess = (content: string | AppendableElement[]): void => {
		this.removeSuccess();
		this.removeError();
		this.success = DOM.create('div', {
			class: 'block notification success',
		});
		if (typeof content === 'string') {
			this.success.textContent = content;
		} else {
			for (let index = 0; index < content.length; index++) {
				const child = content[index];
				this.success.appendChild(child);
			}
		}
		this.manager.node.appendChild(this.success);
	};

	removeError = (): void => {
		if (this.error) {
			this.error.remove();
			this.error = undefined;
		}
	};

	displayError = (content: string | AppendableElement[]): void => {
		this.removeSuccess();
		this.removeError();
		this.error = DOM.create('div', {
			class: 'block notification danger',
		});
		if (typeof content === 'string') {
			this.error.textContent = content;
		} else {
			for (let index = 0; index < content.length; index++) {
				const child = content[index];
				this.error.appendChild(child);
			}
		}
		this.manager.node.appendChild(this.error);
	};
}

export abstract class SaveManager {
	node: HTMLElement;
	options: Options;
	abstract headerName: string;
	abstract services: { [key: string]: ServiceSave };

	constructor(node: HTMLElement, options: Options) {
		this.node = node;
		this.options = options;
	}

	header = (value: string): void => {
		this.node.appendChild(
			DOM.create('h2', {
				class: 'full',
				textContent: value,
			})
		);
	};

	clear = (): void => {
		DOM.clear(this.node);
	};

	abstract serviceKeys: () => string[];

	reset = (): void => {
		this.clear();
		this.header(`Select the Service you want to ${this.headerName}`);
		const serviceList = DOM.create('div', { class: 'services selectable' });
		this.serviceKeys().forEach((value) => {
			DOM.append(serviceList, this.serviceBlock(value));
		});
		DOM.append(this.node, serviceList);
	};

	abstract linkedFunction: (service: string) => () => void;

	serviceBlock = (name: string): HTMLElement => {
		const service = this.services[name];
		const block = DOM.create('div', { class: 'service' });
		const title = DOM.create('span', {
			class: 'title',
			childs: [
				DOM.create('img', {
					attributes: { src: `/icons/${service.key}.png` },
				}),
				DOM.space(),
				service.title(),
			],
		});
		block.addEventListener('click', () => this.linkedFunction(name)());
		return DOM.append(block, title);
	};

	form = (
		fields: {
			type: 'checkbox' | 'input' | 'file';
			text?: string;
			name: string;
		}[],
		callback: (event: Event) => void
	): HTMLFormElement => {
		const form = DOM.create('form', { class: 'block' });
		for (let index = 0; index < fields.length; index++) {
			const field = fields[index];
			if (field.type == 'checkbox') {
				const row = DOM.create('div', { class: 'row' });
				const label = DOM.create('label', {
					textContent: field.text || '',
				});
				const hiddenCheckbox = DOM.create('input', {
					class: 'hidden',
					attributes: {
						name: field.name,
						type: 'checkbox',
					},
				});
				const checkbox = DOM.create('div', { class: 'checkbox disabled' });
				const enable = DOM.create('button', { class: 'on', textContent: 'Enable' });
				const disable = DOM.create('button', {
					class: 'off',
					textContent: 'Disable',
				});
				label.addEventListener('click', () => {
					if (hiddenCheckbox.checked) {
						checkbox.classList.remove('enabled');
						checkbox.classList.add('disabled');
						hiddenCheckbox.checked = false;
					} else {
						checkbox.classList.remove('disabled');
						checkbox.classList.add('enabled');
						hiddenCheckbox.checked = true;
					}
				});
				enable.addEventListener('click', (event) => {
					event.preventDefault();
					checkbox.classList.remove('disabled');
					checkbox.classList.add('enabled');
					hiddenCheckbox.checked = true;
				});
				disable.addEventListener('click', (event) => {
					event.preventDefault();
					checkbox.classList.remove('enabled');
					checkbox.classList.add('disabled');
					hiddenCheckbox.checked = false;
				});
				DOM.append(checkbox, enable, disable);
				DOM.append(form, DOM.append(row, label, hiddenCheckbox, checkbox));
			} else if (field.type == 'file') {
				DOM.append(
					form,
					DOM.create('input', {
						class: 'button action mr-1',
						attributes: {
							name: 'file',
							type: 'file',
						},
					})
				);
			}
		}
		DOM.append(
			form,
			DOM.create('button', {
				class: 'success mr-1',
				textContent: 'Send',
				attributes: { type: 'submit' },
			}),
			DOM.create('button', {
				class: 'danger',
				textContent: 'Cancel',
				events: {
					click: () => this.reset(),
				},
			})
		);
		form.addEventListener('submit', callback);
		DOM.append(this.node, form);
		return form;
	};

	uploadForm = (callback: (event: Event) => void): HTMLFormElement => {
		const form = DOM.create('form', { class: 'block' });
		const fileInput = DOM.create('input', {
			class: 'button action mr-1',
			attributes: {
				name: 'file',
				type: 'file',
			},
		});
		const sendButton = DOM.create('button', {
			class: 'success',
			textContent: 'Send',
			attributes: { type: 'submit' },
		});
		form.addEventListener('submit', callback);
		DOM.append(this.node, DOM.append(form, fileInput, sendButton));
		return form;
	};
}

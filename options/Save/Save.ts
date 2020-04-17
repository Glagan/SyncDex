import { SaveManager } from '../Manager/Save';
import { DOM, AppendableElement } from '../../src/DOM';

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

export abstract class ServiceSave {
	manager: SaveManager;
	block?: HTMLElement;
	errorNotification?: HTMLElement;
	successNode?: HTMLElement;
	abstract name: string;
	abstract key: string;
	abstract import?: () => void;
	abstract export?: () => void;

	constructor(manager: SaveManager) {
		this.manager = manager;
	}

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
		this.manager.node.appendChild(notification);
		return notification;
	};

	createBlock = (): HTMLElement => {
		this.block = DOM.create('div', { class: 'service' });
		const title = DOM.create('span', {
			class: 'title',
			childs: [
				DOM.create('img', {
					attributes: { src: `/icons/${this.key}.png` },
				}),
				DOM.space(),
				this.title(),
			],
		});
		return DOM.append(this.block, title);
	};

	removeNotifications = (): void => {
		if (this.successNode) {
			this.successNode.remove();
			this.successNode = undefined;
		}
		if (this.errorNotification) {
			this.errorNotification.remove();
			this.errorNotification = undefined;
		}
	};

	success = (content: string | AppendableElement[]): void => {
		this.removeNotifications();
		this.successNode = this.notification('success', content);
	};

	error = (content: string | AppendableElement[]): void => {
		this.removeNotifications();
		this.errorNotification = this.notification('danger', content);
	};

	resetButton = (content: string = 'Go back', type: string = 'action'): HTMLButtonElement => {
		return DOM.create('button', {
			class: type,
			textContent: content,
			events: {
				click: () => this.manager.reset(),
			},
		});
	};

	createForm = (
		elements: (Row | AppendableElement)[],
		callback: (event: Event) => void
	): HTMLFormElement => {
		const form = DOM.create('form', { class: 'block' });
		for (let index = 0, len = elements.length; index < len; index++) {
			const element = elements[index];
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
		DOM.append(this.manager.node, form);
		return form;
	};
}

import { AppendableElement, DOM, MessageType } from './DOM';
import { Modal } from './Modal';
import { Module } from './Module';
import { Service } from './Service';

/**
 * An Interface for a generic Module, the interface is inside a Modal.
 */
export class ModuleInterface {
	service: typeof Service;
	modal: Modal;
	form: HTMLFormElement;
	doStop: boolean = false;
	startButton: HTMLButtonElement;
	stopButton: HTMLButtonElement;
	closeButton: HTMLButtonElement;
	cancelButton: HTMLButtonElement;

	constructor(service: typeof Service) {
		this.service = service;
		this.startButton = DOM.create('button', {
			class: 'primary puffy',
			textContent: 'Start',
			childs: [DOM.icon('play')],
			type: 'submit',
		});
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
		this.cancelButton = DOM.create('button', {
			class: 'default',
			childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
			events: {
				click: (event: Event): void => {
					event.preventDefault();
					this.modal.remove();
				},
			},
		});
		this.form = DOM.create('form');
		this.modal = new Modal();
		this.createModal();
		this.modal.body.appendChild(this.form);
		DOM.append(this.modal.footer, this.startButton, this.cancelButton);
	}

	createModal = (): void => {
		this.modal.modal.classList.add('import-export-modal');
		this.stopButton.disabled = false;
		this.doStop = false;
		const realSubmit = DOM.create('button', {
			type: 'submit',
			css: { display: 'none' },
		});
		this.form.appendChild(realSubmit);
		this.form.addEventListener('submit', (event) => {
			event.preventDefault();
			this.form.classList.toggle('closed');
		});
		this.startButton.addEventListener('click', (event) => {
			event.preventDefault();
			realSubmit.click();
		});
	};

	createOptions = (module: Module): void => {
		this.form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		const section = DOM.create('div', {
			class: 'parameter',
			childs: [],
		});
		for (const name in module.options) {
			const option = module.options[name];
			if (option.display) {
				DOM.append(
					section,
					DOM.create('input', {
						type: 'checkbox',
						id: `ck_${name}`,
						name: name,
						checked: option.default,
					}),
					DOM.create('label', { textContent: option.description, htmlFor: `ck_${name}` })
				);
			}
		}
		this.form.appendChild(section);
	};

	bind = (module: Module): void => {
		this.createOptions(module);
		this.modal.header.classList.add(this.service.key);
		this.modal.header.appendChild(this.service.createTitle());
		this.form.name = `save_form_${this.service.key}`;
		this.form.addEventListener('animationend', (event) => {
			if (event.target == this.form && event.animationName == 'shrink') {
				this.form.remove();
				this.modal.disableExit();
				DOM.clear(this.modal.body);
				DOM.clear(this.modal.footer);
				this.modal.footer.appendChild(this.stopButton);
				module.run();
			}
		});
		this.startButton.setAttribute('form', `save_form_${this.service.key}`);
	};

	clear = (): void => {
		DOM.clear(this.modal.body);
		DOM.clear(this.modal.footer);
	};

	complete = (): void => {
		this.modal.enableExit();
		this.stopButton.replaceWith(this.closeButton);
	};

	message = (type: MessageType, content: string | AppendableElement[], parent?: HTMLElement): HTMLElement => {
		const notification = DOM.message(type, content);
		if (parent) {
			parent.appendChild(notification);
		} else {
			this.modal.body.appendChild(notification);
		}
		return notification;
	};

	get body() {
		return this.modal.body;
	}

	get footer() {
		return this.modal.footer;
	}
}

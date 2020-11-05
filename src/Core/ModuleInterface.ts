import { AppendableElement, DOM, MessageType } from './DOM';
import { Modal } from './Modal';
import { Service } from './Service';

/**
 * An Interface for a generic Module, the interface is inside a Modal.
 */
export class ModuleInterface {
	modal: Modal;
	form: HTMLFormElement;
	doStop: boolean = false;
	startButton: HTMLButtonElement;
	stopButton: HTMLButtonElement;
	closeButton: HTMLButtonElement;
	cancelButton: HTMLButtonElement;

	constructor() {
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
		this.createForm();
		this.modal = new Modal();
		this.createModal();
	}

	createForm = (): void => {
		this.form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		// TODO: Not all options in Export
		const section = DOM.create('div', {
			class: 'parameter',
			childs: [
				DOM.create('input', {
					type: 'checkbox',
					id: `ck_merge`,
					name: 'merge',
					checked: true,
					childs: [DOM.create('label', { textContent: 'Merge with current save', htmlFor: `ck_merge` })],
				}),
				DOM.create('input', {
					type: 'checkbox',
					id: `ck_mochi`,
					name: 'mochi',
					checked: true,
					childs: [
						DOM.create('label', {
							textContent: 'Check Services ID with Mochi after Import',
							htmlFor: `ck_mochi`,
						}),
					],
				}),
			],
		});
		this.form.appendChild(section);
	};

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

	bind = (service: typeof Service): void => {
		this.modal.header.classList.add(service.key);
		this.modal.header.appendChild(service.createTitle());
		this.form.name = `save_form_${service.key}`;
		this.form.addEventListener('animationend', (event) => {
			if (event.target == this.form && event.animationName == 'shrink') {
				this.form.remove();
				this.modal.disableExit();
				DOM.clear(this.modal.body);
				DOM.clear(this.modal.footer);
				// TODO: execute
			}
		});
		this.startButton.setAttribute('form', `save_form_${service.key}`);
	};

	reset = (): void => {
		this.clear();
		this.modal.enableExit();
		this.modal.body.appendChild(this.form);
		DOM.append(this.modal.footer, this.startButton, this.cancelButton);
	};

	clear = (): void => {
		DOM.clear(this.modal.body);
		DOM.clear(this.modal.footer);
	};

	complete = (): void => {
		DOM.clear(this.modal.footer);
		this.modal.enableExit();
		this.modal.footer.appendChild(this.closeButton);
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

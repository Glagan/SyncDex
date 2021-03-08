import { DOM } from './DOM';

export class Modal {
	/**
	 * The modal element, absolute element with a background.
	 */
	modal: HTMLElement;
	/**
	 * Container for the modal, with the header and body as childs.
	 */
	wrapper: HTMLElement;
	header: HTMLElement;
	/**
	 * Content of the body
	 */
	body: HTMLElement;
	/**
	 * Footer of the body
	 */
	footer: HTMLElement;
	/**
	 * Flag allowing to close the notification by clicking on the background.
	 */
	canExit: boolean = true;

	constructor(size?: 'small' | 'medium') {
		this.modal = DOM.create('div', {
			class: 'scs modal',
		});
		if (size) this.modal.classList.add(size);
		this.wrapper = DOM.create('div', {
			class: 'scs card',
		});
		this.header = DOM.create('div', {
			class: `header`,
		});
		this.body = DOM.create('div', {
			class: 'body',
		});
		this.footer = DOM.create('div', {
			class: 'footer',
		});
		DOM.append(this.modal, DOM.append(this.wrapper, this.header, this.body, this.footer));
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

	show(): void {
		document.body.appendChild(this.modal);
	}

	remove(): void {
		this.modal.classList.add('closed');
	}

	enableExit(): void {
		this.canExit = true;
	}

	disableExit(): void {
		this.canExit = false;
	}
}

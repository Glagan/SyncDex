import { DOM } from '../src/DOM';

export class Modal {
	/**
	 * The modal element, absolute element with a background.
	 */
	modal: HTMLElement;
	/**
	 * Container for the modal, with the header and body as childs.
	 */
	content: HTMLElement;
	/**
	 * The first element above the body
	 */
	header: HTMLElement;
	/**
	 * The body below the Header
	 */
	body: HTMLElement;
	/**
	 * Flag allowing to close the notification by cliking on the background.
	 */
	canExit: boolean = true;

	constructor(size?: 'small' | 'medium') {
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

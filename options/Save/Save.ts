import { SaveManager } from '../Manager/Save';
import { DOM, AppendableElement } from '../../src/DOM';

export abstract class ServiceSave {
	manager: SaveManager;
	block?: HTMLElement;
	error?: HTMLElement;
	success?: HTMLElement;
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

import { Options, AvailableOptions } from '../../src/Options';

export class Checkbox {
	node: HTMLElement;
	enable: HTMLElement;
	disable: HTMLElement;
	optionName: keyof AvailableOptions;

	constructor(node: HTMLElement) {
		this.node = node;
		this.enable = this.node.querySelector('.on') as HTMLElement;
		this.disable = this.node.querySelector('.off') as HTMLElement;
		this.optionName = this.node.dataset.checkbox as keyof AvailableOptions;
	}

	bind = (): void => {
		this.toggle(Options[this.optionName] as boolean);
		if (this.enable !== null) {
			this.enable.addEventListener('click', () => {
				this.update(true);
			});
		}
		if (this.disable !== null) {
			this.disable.addEventListener('click', () => {
				this.update(false);
			});
		}
	};

	update = (value: boolean): void => {
		if (value != Options.get(this.optionName)) {
			this.node.classList.remove('enabled', 'disabled');
			this.node.classList.add('loading');
			Options.set(this.optionName, value);
			Options.save()
				.then(() => {
					this.node.classList.remove('loading');
					this.toggle(value);
				});
		}
	};

	toggle = (value: boolean): void => {
		if (value) {
			this.node.classList.remove('disabled');
			this.node.classList.add('enabled');
		} else {
			this.node.classList.add('disabled');
			this.node.classList.remove('enabled');
		}
	};
}

export class CheckboxManager {
	checkboxes: Checkbox[] = [];

	constructor() {
		const checkboxes = document.querySelectorAll<HTMLElement>('[data-checkbox]');
		for (let index = 0; index < checkboxes.length; index++) {
			const node = checkboxes[index];
			const checkbox = new Checkbox(node);
			checkbox.bind();
			this.checkboxes.push(checkbox);
		}
	}

	updateAll = (): void => {
		for (let index = 0; index < this.checkboxes.length; index++) {
			const checkbox = this.checkboxes[index];
			checkbox.toggle(Options[checkbox.optionName] as boolean);
		}
	};
}

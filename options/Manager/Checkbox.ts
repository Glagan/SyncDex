import { Options, DefaultOptions } from '../../src/Options';

export class Checkbox {
	node: HTMLElement;
	enable: HTMLElement;
	disable: HTMLElement;
	optionName: keyof DefaultOptions;

	constructor(node: HTMLElement) {
		this.node = node;
		this.enable = this.node.querySelector('.on') as HTMLElement;
		this.disable = this.node.querySelector('.off') as HTMLElement;
		this.optionName = this.node.dataset.checkbox as keyof DefaultOptions;
	}

	bind = (options: Options): void => {
		this.toggle(options.get(this.optionName) as boolean);
		if (this.enable !== null) {
			this.enable.addEventListener('click', () => {
				this.update(options, true);
			});
		}
		if (this.disable !== null) {
			this.disable.addEventListener('click', () => {
				this.update(options, false);
			});
		}
	};

	update = (options: Options, value: boolean): void => {
		if (value != options.get(this.optionName)) {
			this.node.classList.remove('enabled', 'disabled');
			this.node.classList.add('loading');
			options
				.set(this.optionName, value)
				.save()
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

	constructor(options: Options) {
		const checkboxes = document.querySelectorAll<HTMLElement>('[data-checkbox]');
		for (let index = 0; index < checkboxes.length; index++) {
			const node = checkboxes[index];
			const checkbox = new Checkbox(node);
			checkbox.bind(options);
			this.checkboxes.push(checkbox);
		}
	}

	updateAll = (options: Options): void => {
		for (let index = 0; index < this.checkboxes.length; index++) {
			const checkbox = this.checkboxes[index];
			checkbox.toggle(options.get(checkbox.optionName) as boolean);
		}
	};
}

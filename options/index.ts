import { setBrowser } from '../src/Browser';
import { Options, UserOptions } from '../src/Options';

class Checkbox {
	node: HTMLElement;
	options: UserOptions;
	enable: HTMLElement | null = null;
	disable: HTMLElement | null = null;
	optionName: keyof Options;

	constructor(node: HTMLElement, options: UserOptions) {
		this.node = node;
		this.options = options;
		this.enable = this.node.querySelector('.on');
		this.disable = this.node.querySelector('.off');
		this.optionName = this.node.dataset.checkbox as keyof Options;
		this.bind();
		this.enableDisable(this.options.get(this.optionName) as boolean);
	}

	bind = (): void => {
		if (this.enable !== null) {
			this.enable.addEventListener('click', () => {
				this.toggle(true);
			});
		}
		if (this.disable !== null) {
			this.disable.addEventListener('click', () => {
				this.toggle(false);
			});
		}
	};

	toggle = (value: boolean): void => {
		if (value != this.options.get(this.optionName)) {
			this.node.classList.remove('enabled', 'disabled');
			this.node.classList.add('loading');
			this.options
				.set(this.optionName, value)
				.save()
				.then(() => {
					this.node.classList.remove('loading');
					this.enableDisable(value);
				});
		}
	};

	enableDisable = (value: boolean): void => {
		if (value) {
			this.node.classList.remove('disabled');
			this.node.classList.add('enabled');
		} else {
			this.node.classList.add('disabled');
			this.node.classList.remove('enabled');
		}
	};
}

class OptionsManager {
	options: UserOptions = new UserOptions();
	checkboxes: Checkbox[] = [];

	initialize = async (): Promise<void> => {
		await this.options.load();
		const checkboxes = document.querySelectorAll('[data-checkbox]');
		for (let index = 0; index < checkboxes.length; index++) {
			const ck = checkboxes[index] as HTMLElement;
			this.checkboxes.push(new Checkbox(ck, this.options));
		}
	};
}

setBrowser();
const manager = new OptionsManager();
manager.initialize();

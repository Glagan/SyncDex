import { Options, AvailableOptions } from '../../src/Options';
import { DOM } from '../../src/DOM';

// https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c#6f75
type BooleanOptions = Pick<
	AvailableOptions,
	{
		[K in keyof AvailableOptions]: AvailableOptions[K] extends boolean ? K : never;
	}[keyof AvailableOptions]
>;

export class Checkbox {
	enabled: boolean = true;
	node: HTMLElement;
	label: HTMLLabelElement;
	dependencies: Checkbox[] = [];
	optionName: keyof BooleanOptions;
	parent?: keyof BooleanOptions;

	constructor(node: HTMLElement) {
		this.node = node;
		this.node.appendChild(DOM.icon('check'));
		this.label = this.node.nextElementSibling as HTMLLabelElement;
		if (this.label == null) {
			console.log('checkbox', this.node);
		}
		this.optionName = this.node.dataset.checkbox as keyof BooleanOptions;
		if (this.node.dataset.dependency !== undefined) {
			this.parent = this.node.dataset.dependency as keyof BooleanOptions;
			this.node.classList.add('dependency');
			this.label.classList.add('dependency');
		}
	}

	bind = (): void => {
		this.toggle(Options[this.optionName]);
		this.node.addEventListener('click', (event) => {
			event.preventDefault();
			if (!this.enabled) return;
			this.update(!Options[this.optionName]);
		});
		this.label.addEventListener('click', (event) => {
			event.preventDefault();
			if (!this.enabled) return;
			this.update(!Options[this.optionName]);
		});
	};

	enable = (): void => {
		this.enabled = true;
		this.node.classList.remove('disabled');
		this.label.classList.remove('disabled');
	};

	disable = (): void => {
		this.enabled = false;
		this.node.classList.add('disabled');
		this.label.classList.add('disabled');
	};

	update = (value: boolean): void => {
		Options[this.optionName] = value;
		Options.save().then(() => {
			this.toggle(value);
		});
	};

	toggle = (value: boolean): void => {
		if (value) {
			this.node.classList.add('checked');
			for (const dependency of this.dependencies) {
				dependency.enable();
			}
		} else {
			this.node.classList.remove('checked');
			for (const dependency of this.dependencies) {
				dependency.disable();
			}
		}
	};
}

export class CheckboxManager {
	checkboxes: Checkbox[] = [];

	constructor() {
		const checkboxes = document.querySelectorAll<HTMLElement>('[data-checkbox]');
		for (const node of checkboxes) {
			const checkbox = new Checkbox(node);
			checkbox.bind();
			this.checkboxes.push(checkbox);
			// Add dependencies
			if (checkbox.parent !== undefined) {
				for (const parent of this.checkboxes) {
					if (parent.optionName == checkbox.parent) {
						parent.dependencies.push(checkbox);
						parent.toggle(Options[parent.optionName]);
						break;
					}
				}
			}
		}
	}

	updateAll = (): void => {
		for (const checkbox of this.checkboxes) {
			checkbox.toggle(Options[checkbox.optionName]);
		}
	};
}

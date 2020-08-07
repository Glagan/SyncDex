import { Options, AvailableOptions } from '../../src/Options';
import { SaveOptions } from '../Utility';

// https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c#6f75
type BooleanOptions = Pick<
	AvailableOptions,
	{
		[K in keyof AvailableOptions]: AvailableOptions[K] extends boolean ? K : never;
	}[keyof AvailableOptions]
>;

export class Checkbox {
	enabled: boolean = true;
	node: HTMLInputElement;
	label: HTMLLabelElement;
	dependencies: Checkbox[] = [];
	optionName: keyof BooleanOptions;
	parent?: keyof BooleanOptions;

	constructor(node: HTMLInputElement) {
		this.node = node;
		this.label = this.node.nextElementSibling as HTMLLabelElement;
		this.optionName = this.node.dataset.name as keyof BooleanOptions;
		if (this.node.dataset.dependency !== undefined) {
			this.parent = this.node.dataset.dependency as keyof BooleanOptions;
		}
	}

	bind = (): void => {
		this.toggle(Options[this.optionName]);
		this.label.addEventListener('click', (event) => {
			if (event.target !== this.label) return;
			event.preventDefault();
			if (!this.enabled) return;
			this.update(!Options[this.optionName]);
		});
	};

	enable = (): void => {
		this.enabled = true;
		this.node.disabled = false;
	};

	disable = (): void => {
		this.enabled = false;
		this.node.disabled = true;
	};

	update = (value: boolean): void => {
		Options[this.optionName] = value;
		SaveOptions().then(() => {
			this.toggle(value);
		});
	};

	toggle = (value: boolean): void => {
		if (value) {
			this.node.checked = true;
			for (const dependency of this.dependencies) {
				dependency.enable();
			}
		} else {
			this.node.checked = false;
			for (const dependency of this.dependencies) {
				dependency.disable();
			}
		}
	};
}

export class CheckboxManager {
	checkboxes: Checkbox[] = [];

	constructor() {
		const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[type='checkbox']`);
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

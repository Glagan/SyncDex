import { Options, AvailableOptions } from '../../Core/Options';
import { SaveOptions } from '../Utility';

// https://medium.com/dailyjs/typescript-create-a-condition-based-subset-types-9d902cea5b8c#6f75
type BooleanOptions = Pick<
	AvailableOptions,
	{
		[K in keyof AvailableOptions]: AvailableOptions[K] extends boolean ? K : never;
	}[keyof AvailableOptions]
>;

class RawDependency {
	header: HTMLElement | null;
	input: HTMLInputElement;

	constructor(input: HTMLInputElement, header: HTMLElement | null) {
		this.header = header;
		this.input = input;
	}

	enable = (): void => {
		if (this.header) this.header.classList.remove('disabled');
		this.input.disabled = false;
	};

	disable = (): void => {
		if (this.header) this.header.classList.add('disabled');
		this.input.disabled = true;
	};
}

export class Checkbox {
	enabled: boolean = true;
	node: HTMLInputElement;
	label: HTMLLabelElement;
	dependencies: Checkbox[] = [];
	rawDependencies: RawDependency[] = [];
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
			for (const dependency of this.rawDependencies) {
				dependency.enable();
			}
		} else {
			this.node.checked = false;
			for (const dependency of this.dependencies) {
				dependency.disable();
			}
			for (const dependency of this.rawDependencies) {
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

			// Add Raw Dependencies -- input but not checkbox
			let currentNode: Element | null = checkbox.label.nextElementSibling;
			if (currentNode && currentNode.classList.contains('dependency')) {
				let header: Element | null = currentNode;
				while (currentNode) {
					if (currentNode.tagName == 'INPUT') {
						const dependency = new RawDependency(currentNode as HTMLInputElement, header as HTMLElement);
						if (!Options[checkbox.optionName]) dependency.disable();
						checkbox.rawDependencies.push(dependency);
						header = null;
					} else if (currentNode.tagName == 'H2') {
						header = currentNode as HTMLElement;
					}
					currentNode = currentNode.nextElementSibling;
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

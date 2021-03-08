import { Options } from '../../Core/Options';

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
	otherDependencies: Element | null = null;
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

	bind() {
		this.toggle(Options[this.optionName]);
		this.label.addEventListener('click', (event) => {
			if (event.target !== this.label) return;
			event.preventDefault();
			if (!this.enabled) return;
			this.update(!Options[this.optionName]);
		});
	}

	enable() {
		this.enabled = true;
		this.node.disabled = false;
	}

	disable() {
		this.enabled = false;
		this.node.disabled = true;
	}

	async update(value: boolean) {
		Options[this.optionName] = value;
		await Options.save();
		this.toggle(value);
	}

	toggleDependencies(value: boolean) {
		if (this.otherDependencies) {
			if (value) this.otherDependencies.classList.remove('disabled');
			else this.otherDependencies.classList.add('disabled');
			for (const child of this.otherDependencies.children) {
				if (child.tagName == 'INPUT') {
					(child as HTMLInputElement).disabled = !value;
				}
			}
		}
	}

	toggle(value: boolean) {
		this.node.checked = value;
		if (value) {
			for (const dependency of this.dependencies) {
				dependency.enable();
			}
		} else {
			for (const dependency of this.dependencies) {
				dependency.disable();
			}
		}
		this.toggleDependencies(value);
	}
}

export class CheckboxManager {
	checkboxes: Checkbox[] = [];

	constructor() {
		const checkboxes = document.querySelectorAll<HTMLInputElement>(`input[type='checkbox'][data-name]`);
		for (const node of checkboxes) {
			const checkbox = new Checkbox(node);
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
			let dependencies: Element | null = checkbox.label.nextElementSibling;
			if (dependencies && dependencies.classList.contains('helper')) {
				dependencies = dependencies.nextElementSibling;
			}
			if (dependencies && dependencies.classList.contains('dependencies')) {
				checkbox.otherDependencies = dependencies;
			}

			// Bind last to toggle value and add events
			checkbox.bind();
		}
	}

	updateAll() {
		for (const checkbox of this.checkboxes) {
			checkbox.toggle(Options[checkbox.optionName]);
		}
	}
}

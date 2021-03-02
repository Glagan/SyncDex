import { Options } from '../../Core/Options';

type ValidInputs = Omit<
	Pick<
		AvailableOptions,
		{
			[K in keyof AvailableOptions]: AvailableOptions[K] extends number | string ? K : never;
		}[keyof AvailableOptions]
	>,
	'version'
>;
type MinMax = [number, number];

export class Input {
	input: HTMLInputElement;
	type: 'text' | 'number';
	limits: MinMax;
	optionName: keyof ValidInputs;
	static timeout: number = 0;

	constructor(input: HTMLInputElement) {
		this.input = input;
		this.type = this.input.type === 'number' ? 'number' : 'text';
		this.limits = [parseInt(this.input.min), parseInt(this.input.max)];
		if (isNaN(this.limits[0])) this.limits[0] = -Infinity;
		if (isNaN(this.limits[1])) this.limits[1] = +Infinity;
		this.optionName = this.input.dataset.input as keyof ValidInputs;
	}

	bind = (): void => {
		this.update(Options[this.optionName]);
		this.input.addEventListener('input', () => {
			this.input.classList.remove('invalid');
			// Check limits if it's a number input
			let doSave = false;
			if (this.type === 'number') {
				const value = parseInt(this.input.value);
				if (
					typeof Options[this.optionName] === 'number' &&
					!isNaN(value) &&
					value >= this.limits[0] &&
					value <= this.limits[1]
				) {
					(Options[this.optionName] as number) = value;
					doSave = true;
				} else {
					this.input.classList.add('invalid');
				}
			} else {
				(Options[this.optionName] as string) = this.input.value;
				doSave = true;
			}
			// Save the value
			if (doSave) {
				clearTimeout(Input.timeout);
				Input.timeout = window.setTimeout(() => {
					Options.save();
				}, 300);
			}
		});
	};

	update = <K extends keyof ValidInputs>(value: ValidInputs[K]): void => {
		this.input.value = value.toString();
	};
}

export class InputManager {
	inputs: Input[] = [];

	constructor() {
		const inputs = document.querySelectorAll<HTMLInputElement>('[data-input]');
		for (const node of inputs) {
			const input = new Input(node);
			input.bind();
			this.inputs.push(input);
		}
	}

	updateAll = (): void => {
		for (const input of this.inputs) {
			input.update(Options[input.optionName]);
		}
	};
}

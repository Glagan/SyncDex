import { Options, AvailableOptions } from '../../src/Options';
import { SaveOptions } from '../Utility';

type ValidInputs = Omit<
	Pick<
		AvailableOptions,
		{
			[K in keyof AvailableOptions]: AvailableOptions[K] extends number ? K : never;
		}[keyof AvailableOptions]
	>,
	'version'
>;
type MinMax = [number, number];

export class Input {
	input: HTMLInputElement;
	limits: MinMax;
	optionName: keyof ValidInputs;
	static timeout: number = 0;

	constructor(input: HTMLInputElement) {
		this.input = input;
		this.limits = [parseInt(this.input.min), parseInt(this.input.max)];
		this.optionName = this.input.dataset.input as keyof ValidInputs;
	}

	bind = (): void => {
		this.update(Options[this.optionName]);
		this.input.addEventListener('input', () => {
			const value = parseInt(this.input.value);
			this.input.classList.remove('invalid');
			if (!isNaN(value) && value >= this.limits[0] && value <= this.limits[1]) {
				Options[this.optionName] = value;
				clearTimeout(Input.timeout);
				Input.timeout = window.setTimeout(() => {
					SaveOptions();
				}, 300);
			} else {
				this.input.classList.add('invalid');
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

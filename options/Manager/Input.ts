import { Options, AvailableOptions } from '../../src/Options';

type ValidInputs = Pick<AvailableOptions, 'historySize' | 'chaptersSaved'>;
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
				Options.set(this.optionName, value);
				clearTimeout(Input.timeout);
				Input.timeout = window.setTimeout(() => {
					Options.save();
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
		for (let index = 0; index < inputs.length; index++) {
			const node = inputs[index];
			const input = new Input(node);
			input.bind();
			this.inputs.push(input);
		}
	}

	updateAll = (): void => {
		for (let index = 0; index < this.inputs.length; index++) {
			const input = this.inputs[index];
			input.update(Options.get(input.optionName));
		}
	};
}

import { Options, DefaultOptions } from '../../src/Options';

type ValidInputs = Pick<DefaultOptions, 'historySize' | 'chaptersSaved'>;
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

	bind = (options: Options): void => {
		this.update(options.get(this.optionName));
		this.input.addEventListener('input', () => {
			const value = parseInt(this.input.value);
			this.input.classList.remove('invalid');
			if (!isNaN(value) && value >= this.limits[0] && value <= this.limits[1]) {
				options.set(this.optionName, value);
				clearTimeout(Input.timeout);
				Input.timeout = window.setTimeout(() => {
					options.save();
				}, 400);
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

	constructor(options: Options) {
		const inputs = document.querySelectorAll<HTMLInputElement>('[data-input]');
		for (let index = 0; index < inputs.length; index++) {
			const node = inputs[index];
			const input = new Input(node);
			input.bind(options);
			this.inputs.push(input);
		}
	}

	updateAll = (options: Options): void => {
		for (let index = 0; index < this.inputs.length; index++) {
			const input = this.inputs[index];
			input.update(options.get(input.optionName));
		}
	};
}

import { AvailableOptions, Options } from '../../src/Options';

type SingleColor = Exclude<keyof AvailableOptions['colors'], 'highlights'>;

export class Color {
	node: HTMLElement;
	input: HTMLInputElement;
	display: HTMLElement;
	optionName: SingleColor;
	static timeout: number = 0;

	constructor(node: HTMLElement) {
		this.node = node;
		this.optionName = this.node.dataset.color as SingleColor;
		this.input = this.node.querySelector('input') as HTMLInputElement;
		this.display = this.node.querySelector('.color') as HTMLElement;
	}

	bind = (): void => {
		this.update(Options.colors[this.optionName]);
		this.input.addEventListener('input', () => {
			this.display.style.backgroundColor = this.input.value;
			Options.colors[this.optionName] = this.input.value;
			clearTimeout(Color.timeout);
			Color.timeout = window.setTimeout(() => {
				Options.save();
			}, 300);
		});
	};

	update = (value: string): void => {
		this.input.value = value;
		this.display.style.backgroundColor = value;
	};
}

export class ColorManager {
	colors: Color[] = [];

	constructor() {
		const colors = document.querySelectorAll<HTMLElement>('[data-color]');
		for (let index = 0; index < colors.length; index++) {
			const node = colors[index];
			const color = new Color(node);
			color.bind();
			this.colors.push(color);
		}
	}

	updateAll = (): void => {
		for (let index = 0; index < this.colors.length; index++) {
			const color = this.colors[index];
			color.update(Options.colors[color.optionName]);
		}
	};
}

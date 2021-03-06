import { Options } from '../../Core/Options';

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

	bind() {
		this.update(Options.colors[this.optionName]);
		this.input.addEventListener('input', () => {
			this.display.style.backgroundColor = this.input.value;
			Options.colors[this.optionName] = this.input.value;
			clearTimeout(Color.timeout);
			Color.timeout = window.setTimeout(() => {
				Options.save();
			}, 300);
		});
	}

	update(value: string) {
		this.input.value = value;
		this.display.style.backgroundColor = value;
	}
}

export class ColorManager {
	colors: Color[] = [];

	constructor() {
		const colors = document.querySelectorAll<HTMLElement>('[data-color]');
		for (const node of colors) {
			const color = new Color(node);
			color.bind();
			this.colors.push(color);
		}
	}

	updateAll() {
		for (const color of this.colors) {
			color.update(Options.colors[color.optionName]);
		}
	}
}

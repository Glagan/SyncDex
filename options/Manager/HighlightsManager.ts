import { Options } from '../../src/Options';
import { DOM } from '../../src/DOM';

class Highlights {
	index: number;
	node: HTMLElement;
	input: HTMLInputElement;
	display: HTMLElement;
	remove: HTMLElement;
	static timeout: number = 0;

	constructor(index: number) {
		this.index = index;
		this.node = DOM.create('div', {
			class: 'color-input',
		});
		this.display = DOM.create('span', {
			class: 'color',
		});
		this.input = DOM.create('input', {
			attributes: {
				type: 'text',
				placeholder: 'Highlight color',
			},
		});
		this.remove = DOM.create('button', {
			class: 'danger',
			childs: [DOM.create('i', { class: 'lni lni-cross-circle' })],
		});
		DOM.append(this.node, this.remove, this.input, this.display);
	}

	bind = (highlights: HighlightsManager, options: Options): void => {
		this.update(options.colors.highlights[this.index]);
		this.input.addEventListener('input', () => {
			this.display.style.backgroundColor = this.input.value;
			clearTimeout(Highlights.timeout);
			Highlights.timeout = window.setTimeout(() => {
				options.colors.highlights[this.index] = this.input.value;
				options.save();
			}, 400);
		});
		this.remove.addEventListener('click', () => {
			if (options.colors.highlights.length > 1) {
				options.colors.highlights.splice(this.index, 1);
				highlights.list.splice(this.index, 1);
				for (let index = 0; index < highlights.list.length; index++) {
					const row = highlights.list[index];
					if (row.index > this.index) {
						row.index--;
					}
				}
				this.node.remove();
				clearTimeout(Highlights.timeout);
				Highlights.timeout = window.setTimeout(() => {
					options.save();
				}, 400);
			}
		});
	};

	update = (value: string): void => {
		this.input.value = value;
		this.display.style.backgroundColor = value;
	};
}

export class HighlightsManager {
	node: HTMLElement;
	list: Highlights[] = [];

	constructor(options: Options) {
		this.node = document.getElementById('highlights') as HTMLElement;
		this.updateAll(options);
	}

	updateAll = (options: Options): void => {
		const colors = options.colors.highlights;
		this.list = [];
		for (let index = 0; index < colors.length; index++) {
			const color = new Highlights(index);
			color.bind(this, options);
			if (this.node.lastElementChild?.tagName === 'BUTTON') {
				this.node.insertBefore(color.node, this.node.lastElementChild);
			} else {
				DOM.append(this.node, color.node);
			}
			this.list.push(color);
		}
	};
}

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

	bind = (highlights: HighlightsManager): void => {
		this.update(Options.colors.highlights[this.index]);
		this.input.addEventListener('input', () => {
			this.display.style.backgroundColor = this.input.value;
			clearTimeout(Highlights.timeout);
			Highlights.timeout = window.setTimeout(() => {
				Options.colors.highlights[this.index] = this.input.value;
				Options.save();
			}, 300);
		});
		this.remove.addEventListener('click', () => {
			if (Options.colors.highlights.length > 1) {
				Options.colors.highlights.splice(this.index, 1);
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
					Options.save();
				}, 300);
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

	constructor() {
		this.node = document.getElementById('highlights') as HTMLElement;
		const addButton = DOM.create('button', {
			class: 'success',
			events: {
				click: () => {
					const color = new Highlights(Options.colors.highlights.length);
					Options.colors.highlights.push('');
					color.bind(this);
					this.node.insertBefore(color.node, this.node.lastElementChild);
					this.list.push(color);
					color.input.focus();
				},
			},
			childs: [
				DOM.create('i', { class: 'lni lni-circle-plus' }),
				DOM.space(),
				DOM.text('Add color'),
			],
		});
		this.node.appendChild(addButton);
		this.updateAll();
	}

	updateAll = (): void => {
		// Remove previous
		for (let index = 0; index < this.list.length; index++) {
			this.list[index].node.remove();
		}
		// Add current
		this.list = [];
		for (let index = 0; index < Options.colors.highlights.length; index++) {
			const color = new Highlights(index);
			color.bind(this);
			this.node.insertBefore(color.node, this.node.lastElementChild);
			this.list.push(color);
		}
	};
}

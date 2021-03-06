import { Options } from '../../Core/Options';
import { DOM } from '../../Core/DOM';

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
			type: 'text',
			placeholder: 'Highlight color',
		});
		this.remove = DOM.create('button', {
			class: 'ghost danger',
			childs: [DOM.icon('trash')],
		});
		DOM.append(this.node, this.remove, this.input, this.display);
	}

	bind(highlights: HighlightsManager) {
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
				for (const row of highlights.list) {
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
	}

	update(value: string) {
		this.input.value = value;
		this.display.style.backgroundColor = value;
	}
}

export class HighlightsManager {
	node: HTMLElement;
	list: Highlights[] = [];

	constructor() {
		this.node = document.getElementById('highlights')!;
		const addButton = DOM.create('button', {
			class: 'primary',
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
			childs: [DOM.icon('plus'), DOM.text('Add Color')],
		});
		this.node.appendChild(addButton);
		this.updateAll();
	}

	updateAll = (): void => {
		// Remove previous
		for (const highlight of this.list) {
			highlight.node.remove();
		}
		// Add current
		this.list = [];
		for (let index = 0, len = Options.colors.highlights.length; index < len; index++) {
			const color = new Highlights(index);
			color.bind(this);
			this.node.insertBefore(color.node, this.node.lastElementChild);
			this.list.push(color);
		}
	};
}

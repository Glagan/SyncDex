import { setBrowser } from '../src/Browser';
import { Options, UserOptions } from '../src/Options';
import { DOM } from '../src/DOM';

class Highlights {
	node: HTMLElement;
	options: UserOptions;
	timeout: number = 0;
	rows: HTMLElement[] = [];

	constructor(node: HTMLElement, options: UserOptions) {
		this.node = node;
		this.options = options;
		if (this.node) {
			// Add current colors
			const colors = this.options.colors.highlights;
			for (let index = 0; index < colors.length; index++) {
				this.rows.push(this.createRow(index, colors[index]));
			}
			// Add button
			const addButton = DOM.create('button', {
				class: 'success',
				events: {
					click: () => {
						const createdRow = this.createRow(
							this.options.colors.highlights.length,
							''
						);
						this.rows.push(createdRow);
						this.options.colors.highlights.push('');
						createdRow.querySelector('input')?.focus();
					}
				},
				childs: [
					DOM.create('i', { class: 'lni lni-circle-plus' }),
					DOM.space(),
					DOM.text('Add color')
				]
			});
			this.node.appendChild(addButton);
		}
	}

	createRow(index: number, color: string): HTMLElement {
		const row = DOM.create('div', {
			class: 'color-input',
			dataset: {
				index: index.toString()
			}
		});
		const display = DOM.create('span', {
			class: 'color',
			style: {
				backgroundColor: color
			}
		});
		const input = DOM.create('input', {
			attributes: {
				type: 'text',
				placeholder: 'Highlight color',
				value: color
			},
			events: {
				input: () => {
					const index = row.dataset.index as string;
					display.style.backgroundColor = input.value;
					this.options.colors.highlights[parseInt(index)] = input.value;
					this.timeout = window.setTimeout(() => {
						this.options.save();
					}, 400);
				}
			}
		});
		const remove = DOM.create('button', {
			class: 'danger',
			childs: [DOM.create('i', { class: 'lni lni-cross-circle' })],
			events: {
				// Remove current row and update data-index references
				click: () => {
					if (this.options.colors.highlights.length > 1) {
						const index = parseInt(row.dataset.index as string);
						this.options.colors.highlights.splice(index, 1);
						this.rows.splice(index, 1);
						this.rows.forEach(nextRow => {
							const idx = parseInt(nextRow.dataset.index as string);
							if (idx > index) {
								nextRow.dataset.index = (idx - 1).toString();
							}
						});
						row.remove();
						this.options.save();
					}
				}
			}
		});
		DOM.append(row, remove, input, display);
		if (this.node.lastElementChild?.tagName === 'BUTTON') {
			return this.node.insertBefore(row, this.node.lastElementChild);
		} else {
			DOM.append(this.node, row);
		}
		return row;
	}
}

class Color {
	node: HTMLElement;
	options: UserOptions;
	input: HTMLInputElement | null = null;
	display: HTMLElement | null = null;
	optionName: keyof Options['colors'];
	timeout: number = 0;

	constructor(node: HTMLElement, options: UserOptions) {
		this.node = node;
		this.options = options;
		this.optionName = this.node.dataset.color as keyof Options['colors'];
		this.input = this.node.querySelector('input');
		this.display = this.node.querySelector('.color');
		this.bind();
		if (this.input && this.optionName != 'highlights') {
			this.input.value = this.options.colors[this.optionName];
			this.update();
		}
	}

	bind = (): void => {
		if (this.input !== null) {
			this.input.addEventListener('input', event => {
				this.update();
				clearTimeout(this.timeout);
				this.timeout = window.setTimeout(() => {
					(this.options.colors[this.optionName] as string) = (this
						.input as HTMLInputElement).value;
					this.options.save();
				}, 400);
			});
		}
	};

	update = (): void => {
		if (this.display && this.input) {
			this.display.style.backgroundColor = this.input.value;
		}
	};
}

class Checkbox {
	node: HTMLElement;
	options: UserOptions;
	enable: HTMLElement | null = null;
	disable: HTMLElement | null = null;
	optionName: keyof Options;

	constructor(node: HTMLElement, options: UserOptions) {
		this.node = node;
		this.options = options;
		this.enable = this.node.querySelector('.on');
		this.disable = this.node.querySelector('.off');
		this.optionName = this.node.dataset.checkbox as keyof Options;
		this.bind();
		this.enableDisable(this.options.get(this.optionName) as boolean);
	}

	bind = (): void => {
		if (this.enable !== null) {
			this.enable.addEventListener('click', () => {
				this.update(true);
			});
		}
		if (this.disable !== null) {
			this.disable.addEventListener('click', () => {
				this.update(false);
			});
		}
	};

	update = (value: boolean): void => {
		if (value != this.options.get(this.optionName)) {
			this.node.classList.remove('enabled', 'disabled');
			this.node.classList.add('loading');
			this.options
				.set(this.optionName, value)
				.save()
				.then(() => {
					this.node.classList.remove('loading');
					this.enableDisable(value);
				});
		}
	};

	enableDisable = (value: boolean): void => {
		if (value) {
			this.node.classList.remove('disabled');
			this.node.classList.add('enabled');
		} else {
			this.node.classList.add('disabled');
			this.node.classList.remove('enabled');
		}
	};
}

class OptionsManager {
	options: UserOptions = new UserOptions();
	colors: Color[] = [];
	checkboxes: Checkbox[] = [];
	highlights: Highlights | null = null;

	initialize = async (): Promise<void> => {
		await this.options.load();
		// Colors
		const colors = document.querySelectorAll('[data-color]');
		for (let index = 0; index < colors.length; index++) {
			const color = colors[index] as HTMLElement;
			this.colors.push(new Color(color, this.options));
		}
		// Highlights
		const highlights = document.getElementById('highlights');
		if (highlights) {
			this.highlights = new Highlights(highlights, this.options);
		}
		// Checkboxes
		const checkboxes = document.querySelectorAll('[data-checkbox]');
		for (let index = 0; index < checkboxes.length; index++) {
			const checkbox = checkboxes[index] as HTMLElement;
			this.checkboxes.push(new Checkbox(checkbox, this.options));
		}
	};
}

setBrowser();
const manager = new OptionsManager();
manager.initialize();

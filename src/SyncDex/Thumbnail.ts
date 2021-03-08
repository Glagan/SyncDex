import { DOM } from '../Core/DOM';
import { MangaDex } from '../Core/MangaDex';
import { Options } from '../Core/Options';
import { LocalTitle } from '../Core/Title';

export class Thumbnail {
	static container?: HTMLElement;
	static list: { [key: number]: Thumbnail } = {};

	id: number;
	thumbnail: HTMLElement;
	tooltipThumb: HTMLImageElement;
	container: HTMLElement;
	content: HTMLElement;
	currentRow: HTMLElement | undefined;
	hideTimeout: number | undefined;

	constructor(id: number, title?: LocalTitle) {
		this.id = id;

		// Create tooltip
		this.container = DOM.create('div');
		this.thumbnail = DOM.create('div', {
			class: 'tooltip loading',
			css: {
				left: `-${window.innerWidth}px`,
				maxHeight: `${(window.innerHeight - 10) * (Options.thumbnailMaxHeight / 100)}px`,
			},
			childs: [this.container],
		});
		let spinner = DOM.create('i', {
			class: 'fas fa-circle-notch fa-spin',
		});
		this.container.appendChild(spinner);
		if (Thumbnail.container === undefined) {
			Thumbnail.container = DOM.create('div', {
				id: 'tooltip-container',
			});
			document.body.appendChild(Thumbnail.container);
		}
		Thumbnail.container.appendChild(this.thumbnail);

		// Thumbnail
		this.tooltipThumb = DOM.create('img', {
			class: 'thumbnail loading',
			css: { maxHeight: `${(window.innerHeight - 10) * (Options.thumbnailMaxHeight / 100)}px` },
		});
		this.tooltipThumb.style.length;
		this.container.appendChild(this.tooltipThumb);

		// Load cover
		this.tooltipThumb.addEventListener('load', () => {
			delete this.thumbnail.dataset.loading;
			this.thumbnail.dataset.loaded = 'true';
			// Remove the spinner
			spinner.remove();
			this.thumbnail.classList.remove('loading');
			this.thumbnail.style.left = `-${window.innerWidth}px`;
			this.tooltipThumb.classList.remove('loading');
			// Update position
			if (this.thumbnail.classList.contains('active') && this.currentRow) {
				setTimeout(() => {
					this.updatePosition(this.currentRow!);
				}, 1);
			}
		});
		const extensions = ['jpg', 'png', 'jpeg', 'gif'];
		this.tooltipThumb.addEventListener('error', () => {
			if (Options.originalThumbnail) {
				const tryNumber = this.tooltipThumb.dataset.ext ? parseInt(this.tooltipThumb.dataset.ext) : 1;
				if (tryNumber < extensions.length) {
					this.tooltipThumb.src = MangaDex.thumbnail({ id }, 'original', extensions[tryNumber]);
					this.tooltipThumb.dataset.ext = `${tryNumber + 1}`;
				} else {
					this.tooltipThumb.src = '';
				}
			}
		});

		// Content (Chapter, Volume)
		this.content = DOM.create('div', { class: 'content' });
		if (title && Options.progressInThumbnail) this.updateContent(title);
	}

	// Events
	activateTooltip(row: HTMLElement, rightColumn: boolean) {
		clearTimeout(this.hideTimeout);
		this.currentRow = row;
		this.thumbnail.dataset.column = rightColumn.toString();
		this.thumbnail.classList.add('active');
		if (this.thumbnail.dataset.loading) {
			this.updatePosition(row);
			return;
		}
		if (!this.thumbnail.dataset.loaded) {
			this.thumbnail.dataset.loading = 'true';
			// Will trigger 'load' event
			if (Options.originalThumbnail) {
				this.tooltipThumb.src = MangaDex.thumbnail({ id: this.id }, 'original');
				this.tooltipThumb.dataset.ext = '1';
			} else {
				this.tooltipThumb.src = MangaDex.thumbnail({ id: this.id }, 'large');
			}
		}
		this.updatePosition(row);
	}

	disableTooltip() {
		this.hideTimeout = setTimeout(() => {
			this.thumbnail.classList.remove('active');
			this.thumbnail.style.left = '-5000px';
		}, 10);
	}

	bindRow(row: HTMLElement) {
		// First column
		if (row.firstElementChild) {
			row.firstElementChild.addEventListener('mouseenter', (event) => {
				event.stopPropagation();
				this.activateTooltip(row, false);
			});
		}

		// Second column
		if (row.lastElementChild) {
			row.lastElementChild.addEventListener('mouseenter', (event) => {
				event.stopPropagation();
				this.activateTooltip(row, true);
			});
		}

		// Row
		row.addEventListener('mouseleave', (event) => {
			event.stopPropagation();
			this.disableTooltip();
		});
		row.addEventListener('mouseout', (event) => {
			event.stopPropagation();
			if (event.target == row) {
				this.disableTooltip();
			}
		});
	}

	updateContent(title: LocalTitle) {
		DOM.clear(this.content);
		let hasContent = false;
		if (title.chapter) {
			DOM.append(
				this.content,
				DOM.icon('bookmark'),
				DOM.space(),
				DOM.text('Chapter'),
				DOM.space(),
				DOM.text(`${title.chapter}`)
			);
			hasContent = true;
		}
		if (title.volume) {
			DOM.append(
				this.content,
				DOM.create('br'),
				DOM.icon('book'),
				DOM.space(),
				DOM.text('Volume'),
				DOM.space(),
				DOM.text(`${title.volume}`)
			);
			hasContent = true;
		}
		if (hasContent) this.container.appendChild(this.content);
	}

	updatePosition(row: HTMLElement) {
		let rightColumn = this.thumbnail.dataset.column == 'true';
		let rect = {
			thumbnail: this.thumbnail.getBoundingClientRect(),
			row: row.getBoundingClientRect(),
			firstChild: {} as DOMRect,
			lastChild: {} as DOMRect,
		};
		// Calculate to place on the left of the main column by default
		let left = Math.max(5, rect.row.x - rect.thumbnail.width - 5);
		let maxWidth = rect.row.left - 10;
		// Boundaries
		if ((Options.originalThumbnail && rect.row.left < 400) || rect.row.left < 100) {
			if (rightColumn && row.lastElementChild) {
				rect.lastChild = row.lastElementChild.getBoundingClientRect();
				maxWidth = rect.lastChild.left - 10;
			} else if (!rightColumn && row.firstElementChild) {
				rect.firstChild = row.firstElementChild.getBoundingClientRect();
				maxWidth = document.body.clientWidth - 10;
			}
		}
		this.thumbnail.style.maxWidth = `${maxWidth}px`;
		// X axis
		setTimeout(() => {
			if ((Options.originalThumbnail && rect.row.left < 400) || rect.row.left < 100) {
				if (rightColumn) {
					left = rect.lastChild.left - 5 - Math.min(maxWidth, rect.thumbnail.width);
				} else {
					left = rect.firstChild.right + 5;
				}
			}
			this.thumbnail.style.left = `${left}px`;
		}, 1);
		// Y axis
		rect.thumbnail = this.thumbnail.getBoundingClientRect();
		let top = window.scrollY + rect.row.y + rect.row.height / 2 - rect.thumbnail.height / 2;
		if (top <= window.scrollY) {
			top = window.scrollY + 5;
		} else if (top + rect.thumbnail.height > window.scrollY + window.innerHeight) {
			top = window.scrollY + window.innerHeight - rect.thumbnail.height - 5;
		}
		this.thumbnail.style.top = `${top}px`;
	}

	static bind(id: number, row: HTMLElement, title?: LocalTitle): Thumbnail {
		if (!Thumbnail.list[id]) {
			Thumbnail.list[id] = new Thumbnail(id, title);
		}
		Thumbnail.list[id].bindRow(row);
		return Thumbnail.list[id];
	}
}

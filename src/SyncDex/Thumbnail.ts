import { DOM } from '../Core/DOM';
import { Options } from '../Core/Options';

export class Thumbnail {
	static container?: HTMLElement;
	row: HTMLElement;
	thumbnail: HTMLElement;

	constructor(id: number, row: HTMLElement) {
		this.row = row;
		// Create tooltip
		this.thumbnail = DOM.create('div', {
			class: 'tooltip loading',
			css: {
				left: `-${window.innerWidth}px`,
				maxHeight: `${(window.innerHeight - 10) * (Options.thumbnailMaxHeight / 100)}px`,
			},
		});
		let spinner = DOM.create('i', {
			class: 'fas fa-circle-notch fa-spin',
		});
		this.thumbnail.appendChild(spinner);
		if (Thumbnail.container === undefined) {
			Thumbnail.container = DOM.create('div', {
				id: 'tooltip-container',
			});
			document.body.appendChild(Thumbnail.container);
		}
		Thumbnail.container.appendChild(this.thumbnail);
		// Thumbnail
		let tooltipThumb = DOM.create('img', {
			class: 'thumbnail loading',
			css: {
				maxHeight: `${(window.innerHeight - 10) * (Options.thumbnailMaxHeight / 100)}px`,
			},
		});
		tooltipThumb.style.length;
		this.thumbnail.appendChild(tooltipThumb);
		// Load cover
		tooltipThumb.addEventListener('load', () => {
			delete this.row.dataset.loading;
			this.row.dataset.loaded = 'true';
			// Remove the spinner
			spinner.remove();
			this.thumbnail.classList.remove('loading');
			this.thumbnail.style.left = `-${window.innerWidth}px`;
			tooltipThumb.classList.remove('loading');
			// Update position
			if (this.thumbnail.classList.contains('active')) {
				setTimeout(() => {
					this.updatePosition();
				}, 1);
			}
		});
		let extensions = ['jpg', 'png', 'jpeg', 'gif'];
		tooltipThumb.addEventListener('error', () => {
			if (Options.originalThumbnail) {
				let tryNumber = tooltipThumb.dataset.ext ? Math.floor(parseInt(tooltipThumb.dataset.ext)) : 1;
				if (tryNumber < extensions.length) {
					tooltipThumb.src = `https://mangadex.org/images/manga/${id}.${extensions[tryNumber]}`;
					tooltipThumb.dataset.ext = (tryNumber + 1).toString();
				} else {
					tooltipThumb.src = '';
				}
			}
		});
		// Events
		let activateTooltip = (rightColumn: boolean) => {
			this.thumbnail.dataset.column = rightColumn.toString();
			this.thumbnail.classList.add('active');
			if (this.row.dataset.loading) {
				this.updatePosition();
				return;
			}
			if (!this.row.dataset.loaded) {
				this.row.dataset.loading = 'true';
				// Will trigger 'load' event
				if (Options.originalThumbnail) {
					tooltipThumb.src = `https://mangadex.org/images/manga/${id}.jpg`;
					tooltipThumb.dataset.ext = '1';
				} else {
					tooltipThumb.src = `https://mangadex.org/images/manga/${id}.large.jpg`;
				}
			}
			this.updatePosition();
		};
		let disableTooltip = () => {
			this.thumbnail.classList.remove('active');
			this.thumbnail.style.left = '-5000px';
		};
		// First column
		if (this.row.firstElementChild) {
			this.row.firstElementChild.addEventListener('mouseenter', (event) => {
				event.stopPropagation();
				activateTooltip(false);
			});
		}
		// Second column
		if (this.row.lastElementChild) {
			this.row.lastElementChild.addEventListener('mouseenter', (event) => {
				event.stopPropagation();
				activateTooltip(true);
			});
		}
		// Row
		this.row.addEventListener('mouseleave', (event) => {
			event.stopPropagation();
			disableTooltip();
		});
		this.row.addEventListener('mouseout', (event) => {
			event.stopPropagation();
			if (event.target == this.row) {
				disableTooltip();
			}
		});
	}

	updatePosition = (): void => {
		let rightColumn = this.thumbnail.dataset.column == 'true';
		let rect = {
			thumbnail: this.thumbnail.getBoundingClientRect(),
			row: this.row.getBoundingClientRect(),
			firstChild: {} as DOMRect,
			lastChild: {} as DOMRect,
		};
		// Calculate to place on the left of the main column by default
		let left = Math.max(5, rect.row.x - rect.thumbnail.width - 5);
		let maxWidth = rect.row.left - 10;
		// Boundaries
		if ((Options.originalThumbnail && rect.row.left < 400) || rect.row.left < 100) {
			if (rightColumn && this.row.lastElementChild) {
				rect.lastChild = this.row.lastElementChild.getBoundingClientRect();
				maxWidth = rect.lastChild.left - 10;
			} else if (!rightColumn && this.row.firstElementChild) {
				rect.firstChild = this.row.firstElementChild.getBoundingClientRect();
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
	};
}

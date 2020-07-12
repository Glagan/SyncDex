import { DOM } from './DOM';
import { Options } from './Options';

interface ChapterRow {
	progress: Progress | undefined;
	node: HTMLElement;
	hidden: boolean;
}

class ChapterGroup {
	titleId: number = 0;
	name: string = '';
	/**
	 * List of all chapter rows in the group, starting from the top.
	 */
	rows: ChapterRow[] = [];
	static currentColor: number = 0;

	hide = (progress: Progress): void => {
		if (!Options.hideHigher && !Options.hideLower && !Options.hideLast) return;
		let chapterCount = this.rows.length;
		for (const row of this.rows) {
			if (!row.progress) continue;
			if (
				row.progress.chapter >= Math.floor(progress.chapter) + 2 ||
				(Options.hideLower && row.progress.chapter < progress.chapter) ||
				(Options.hideLast && progress.chapter == row.progress.chapter)
			) {
				row.node.classList.add('hidden');
				row.hidden = true;
			}
		}
		// Display the title on the first not hidden chapter
		if (this.rows[0].hidden) {
			let j = 1;
			while (j < chapterCount && this.rows[j].hidden) j++;
			if (j < chapterCount) {
				let link = DOM.create('a', {
					textContent: this.name,
					class: 'text-truncate',
					href: `/title/${this.titleId}`,
					title: this.name,
				});
				this.rows[j].node.firstElementChild?.appendChild(link);
			}
		}
	};

	highlight = (progress: Progress): void => {
		let lastColor = Options.colors.highlights.length,
			// index of the next or current chapter in the group
			selected = -1,
			foundNext = false,
			outerColor = Options.colors.highlights[ChapterGroup.currentColor];
		// If there is data
		let chapterCount = this.rows.length;
		for (let j = 0; j < chapterCount; j++) {
			let row = this.rows[j];
			row.node.classList.add('has-fast-in-transition');
			if (row.progress) {
				if (
					row.progress.chapter > progress.chapter &&
					row.progress.chapter < Math.floor(progress.chapter) + 2
				) {
					// * Next Chapter
					row.node.style.backgroundColor = Options.colors.nextChapter;
					selected = j;
					foundNext = true;
					outerColor = Options.colors.nextChapter;
				} else if (row.progress.chapter > progress.chapter) {
					// * Higher Chapter
					row.node.style.backgroundColor = Options.colors.higherChapter;
				} else if (row.progress.chapter < progress.chapter) {
					// * Lower Chapter
					row.node.style.backgroundColor = Options.colors.lowerChapter;
				} else if (progress.chapter == row.progress.chapter) {
					// * Current Chapter
					row.node.style.backgroundColor = Options.colors.highlights[ChapterGroup.currentColor];
					if (!foundNext) selected = j;
				}
			}
		}
		if (selected >= 0) {
			for (let j = 0; j < chapterCount; j++) {
				if (j == selected) break;
				if (this.rows[j].progress && this.rows[j].progress?.chapter == this.rows[selected].progress?.chapter)
					continue;
				(this.rows[j].node.firstElementChild as HTMLElement).style.backgroundColor = outerColor;
			}
		}
		ChapterGroup.currentColor = (ChapterGroup.currentColor + 1) % lastColor;
	};

	setThumbnail = (container: HTMLElement): void => {
		// Add events
		for (const group of this.rows) {
			this.setRowThumbnail(container, group.node);
		}
	};

	setRowThumbnail = (container: HTMLElement, row: HTMLElement): void => {
		// Create tooltip
		let tooltip = DOM.create('div', {
			class: 'sd-tooltip loading',
			css: {
				left: `-${window.innerWidth}px`,
				maxHeight: `${(window.innerHeight - 10) * (Options.thumbnailMaxHeight / 100)}px`,
			},
		});
		let spinner = DOM.create('i', {
			class: 'fas fa-circle-notch fa-spin',
		});
		tooltip.appendChild(spinner);
		container.appendChild(tooltip);
		// Thumbnail
		let tooltipThumb = DOM.create('img', {
			class: 'thumbnail loading',
			css: {
				maxHeight: `${(window.innerHeight - 10) * (Options.thumbnailMaxHeight / 100)}px`,
			},
		});
		tooltipThumb.style.length;
		tooltip.appendChild(tooltipThumb);
		// Load cover
		tooltipThumb.addEventListener('load', () => {
			delete row.dataset.loading;
			row.dataset.loaded = 'true';
			// Remove the spinner
			spinner.remove();
			tooltip.classList.remove('loading');
			tooltip.style.left = `-${window.innerWidth}px`;
			tooltipThumb.classList.remove('loading');
			// Update position
			if (tooltip.classList.contains('active')) {
				setTimeout(() => {
					this.updateThumbnailPosition(tooltip, row);
				}, 1);
			}
		});
		let extensions = ['jpg', 'png', 'jpeg', 'gif'];
		tooltipThumb.addEventListener('error', () => {
			if (Options.originalThumbnail) {
				let tryNumber = tooltipThumb.dataset.ext ? Math.floor(parseInt(tooltipThumb.dataset.ext)) : 1;
				if (tryNumber < extensions.length) {
					tooltipThumb.src = `https://mangadex.org/images/manga/${this.titleId}.${extensions[tryNumber]}`;
					tooltipThumb.dataset.ext = (tryNumber + 1).toString();
				} else {
					tooltipThumb.src = '';
				}
			}
		});
		// Events
		let activateTooltip = (rightColumn: boolean) => {
			tooltip.dataset.column = rightColumn.toString();
			tooltip.classList.add('active');
			if (row.dataset.loading) {
				this.updateThumbnailPosition(tooltip, row);
				return;
			}
			if (!row.dataset.loaded) {
				row.dataset.loading = 'true';
				// Will trigger 'load' event
				if (Options.originalThumbnail) {
					tooltipThumb.src = `https://mangadex.org/images/manga/${this.titleId}.jpg`;
					tooltipThumb.dataset.ext = '1';
				} else {
					tooltipThumb.src = `https://mangadex.org/images/manga/${this.titleId}.thumb.jpg`;
				}
			}
			this.updateThumbnailPosition(tooltip, row);
		};
		let disableTooltip = () => {
			tooltip.classList.remove('active');
			tooltip.style.left = '-5000px';
		};
		// First column
		if (row.firstElementChild) {
			row.firstElementChild.addEventListener('mouseenter', (event) => {
				event.stopPropagation();
				activateTooltip(false);
			});
		}
		// Second column
		if (row.lastElementChild) {
			row.lastElementChild.addEventListener('mouseenter', (event) => {
				event.stopPropagation();
				activateTooltip(true);
			});
		}
		// Row
		row.addEventListener('mouseleave', (event) => {
			event.stopPropagation();
			disableTooltip();
		});
		row.addEventListener('mouseout', (event) => {
			event.stopPropagation();
			if (event.target == row) {
				disableTooltip();
			}
		});
	};

	updateThumbnailPosition = (tooltip: HTMLElement, row: HTMLElement): void => {
		let rightColumn = tooltip.dataset.column == 'true';
		let rect = {
			tooltip: tooltip.getBoundingClientRect(),
			row: row.getBoundingClientRect(),
			firstChild: {} as DOMRect,
			lastChild: {} as DOMRect,
		};
		// Calculate to place on the left of the main column by default
		let left = Math.max(5, rect.row.x - rect.tooltip.width - 5);
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
		tooltip.style.maxWidth = `${maxWidth}px`;
		// X axis
		setTimeout(() => {
			if ((Options.originalThumbnail && rect.row.left < 400) || rect.row.left < 100) {
				if (rightColumn) {
					left = rect.lastChild.left - 5 - Math.min(maxWidth, rect.tooltip.width);
				} else {
					left = rect.firstChild.right + 5;
				}
			}
			tooltip.style.left = `${left}px`;
		}, 1);
		// Y axis
		rect.tooltip = tooltip.getBoundingClientRect();
		let top = window.scrollY + rect.row.y + rect.row.height / 2 - rect.tooltip.height / 2;
		if (top <= window.scrollY) {
			top = window.scrollY + 5;
		} else if (top + rect.tooltip.height > window.scrollY + window.innerHeight) {
			top = window.scrollY + window.innerHeight - rect.tooltip.height - 5;
		}
		tooltip.style.top = `${top}px`;
	};
}

export class MangaDex {
	document: Document;

	constructor(document: Document) {
		this.document = document;
	}

	getChaptersGroups = (): ChapterGroup[] => {
		let chapterContainer = this.document.querySelector<HTMLElement>('.chapter-container');
		if (!chapterContainer) return [];
		let nodes = chapterContainer.children;
		let groups: ChapterGroup[] = [];
		if (nodes.length > 1) {
			let currentGroup = new ChapterGroup();
			for (const row of nodes) {
				let chapterRow = row.querySelector<HTMLElement>('[data-chapter]');
				const firstChild = row.firstElementChild!;
				if (chapterRow && chapterRow.dataset.mangaId && firstChild) {
					let titleId = Math.floor(parseInt(chapterRow.dataset.mangaId));
					let isFirstRow = firstChild && firstChild.childElementCount > 0;
					// Is this is a new entry push the current group and create a new one
					if (isFirstRow) {
						if (currentGroup.rows.length > 0) {
							groups.push(currentGroup);
						}
						currentGroup = new ChapterGroup();
						Object.assign(currentGroup, {
							titleId: titleId,
							name: (firstChild.textContent as string).trim(),
							chapters: [],
						});
					}
					let chapter: ChapterRow = {
						progress: (() => {
							if (chapterRow.dataset.chapter) {
								return {
									chapter: parseFloat(chapterRow.dataset.chapter),
									volume: parseFloat(chapterRow.dataset?.volume || '') || undefined,
								};
							}
							return undefined;
						})(),
						node: row as HTMLElement,
						hidden: false,
					};
					// Don't add empty chapters
					if (chapter.progress) {
						currentGroup.rows.push(chapter);
					}
				}
			}
			// Push last group
			if (currentGroup.rows.length > 0) {
				groups.push(currentGroup);
			}
		}
		return groups;
	};
}

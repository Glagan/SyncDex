import { DOM } from '../Core/DOM';
import { Options } from '../Core/Options';
import { Title } from '../Core/Title';
import { SyncModule } from './SyncModule';

export interface ChapterRow {
	next?: ChapterRow;
	isNext: boolean;
	node: HTMLElement;
	parent: HTMLElement;
	manage: HTMLElement;
	toggleButton?: HTMLButtonElement;
	toggleIcon?: HTMLElement;
	markButton: HTMLElement;
	previous?: ChapterRow;
	chapter: number;
}

export class ChapterList {
	highest: number = 0;
	rows: ChapterRow[] = [];

	// Find each rows, their previous/next and add CSS for animations
	constructor() {
		const chapterRows = document.querySelectorAll<HTMLElement>('.chapter-row');
		let previousRow: ChapterRow | undefined;
		for (const row of chapterRows) {
			const chapter = row.dataset.title == 'Oneshot' ? 0 : parseFloat(row.dataset.chapter!);
			if (!isNaN(chapter)) {
				// Add CSS
				const parentRow = row.querySelector(`a[href^='/chapter']`)!.parentElement!;
				parentRow.classList.add('title-column');
				row.classList.add('has-transition', 'chapter-row');
				row.style.backgroundColor = '';
				// Save to the list
				const chapterRow: ChapterRow = {
					next: previousRow,
					isNext: false,
					node: row,
					parent: parentRow,
					manage: DOM.create('div'),
					chapter: chapter,
					markButton: DOM.create('button', {
						class: 'btn btn-secondary btn-sm set-latest',
						childs: [DOM.icon('book'), DOM.space(), DOM.text('Set Latest')],
						title: 'Set as the Latest chapter',
					}),
				};
				// Insert buttons
				chapterRow.manage.insertBefore(chapterRow.markButton, chapterRow.manage.lastElementChild);
				chapterRow.parent.appendChild(chapterRow.manage);
				// Add toggle button if needed
				if (Options.saveOpenedChapters) {
					chapterRow.toggleIcon = DOM.icon('plus');
					chapterRow.toggleButton = DOM.create('button', {
						class: 'btn btn-secondary btn-sm toggle-open',
						childs: [chapterRow.toggleIcon],
						title: 'Add to chapter list',
					});
					chapterRow.manage.appendChild(chapterRow.toggleButton);
				}
				if (previousRow) {
					previousRow.previous = chapterRow;
				}

				this.rows.unshift(chapterRow);
				previousRow = chapterRow;
				// Calculate highest chapter
				if (chapter > this.highest) this.highest = chapter;
			}
		}
	}

	bind(syncModule: SyncModule): void {
		const title = syncModule.title;
		for (const row of this.rows) {
			// Bind the +/- button for the Chapter list of the Title
			if (row.toggleButton) {
				row.toggleButton.addEventListener('click', async (event) => {
					event.preventDefault();
					if (row.toggleIcon!.classList.contains('fa-minus')) {
						title.removeChapter(row.chapter);
						if (!row.isNext) row.node.style.backgroundColor = '';
						row.toggleButton!.title = 'Add to chapter list';
					} else {
						title.addChapter(row.chapter);
						if (!row.isNext) row.node.style.backgroundColor = Options.colors.openedChapter;
						row.toggleButton!.title = 'Remove from chapter list';
					}
					await title.persist();
					// Switch to add/remove
					row.toggleIcon!.classList.toggle('fa-minus');
					row.toggleIcon!.classList.toggle('fa-plus');
				});
			}
			// Bind the 'Set as Latest' button
			row.markButton.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.chapter == title.progress.chapter) return;
				// Remove everything above current -- highligth and from opened
				let higherRow = row;
				while (higherRow.next && higherRow.next.chapter <= title.progress.chapter) {
					title.removeChapter(higherRow.next.chapter);
					higherRow.next.node.style.backgroundColor = '';
					higherRow.next.isNext = false;
					if (higherRow.next.toggleIcon) {
						higherRow.next.toggleIcon.classList.remove('fa-minus');
						higherRow.next.toggleIcon.classList.add('fa-plus');
					}
					higherRow = higherRow.next;
				}
				// Remove next highlight
				if (higherRow.next) {
					higherRow.next.node.style.backgroundColor = '';
					higherRow.next.isNext = false;
					if (higherRow.next.toggleIcon) {
						higherRow.next.toggleIcon.classList.remove('fa-minus');
						higherRow.next.toggleIcon.classList.add('fa-plus');
					}
				}
				// Mark everything up to current as read and highlight
				let currentRow: ChapterRow | undefined = row;
				while (currentRow) {
					title.addChapter(currentRow.chapter);
					currentRow.node.style.backgroundColor = Options.colors.openedChapter;
					currentRow.isNext = false;
					if (currentRow.toggleIcon) {
						currentRow.toggleIcon.classList.add('fa-minus');
						currentRow.toggleIcon.classList.remove('fa-plus');
					}
					currentRow = currentRow.previous;
				}
				// Highlight
				const previousCurrent = document.querySelector<HTMLElement>('.col.current');
				if (previousCurrent) previousCurrent.classList.remove('current');
				row.parent.classList.add('current');
				if (row.next) {
					row.next.node.style.backgroundColor = Options.colors.nextChapter;
					row.next.isNext = true;
				}
				// Update Title
				title.progress.chapter = row.chapter;
				if (title.status == Status.NONE) {
					title.status = Status.READING;
					title.start = new Date();
				}
				await title.persist();
				syncModule.overview.syncedLocal(title);
				await syncModule.syncExternal(true);
			});
		}
	}

	highlight(title: Title): void {
		let foundNext = false;
		for (const row of this.rows) {
			// Reset
			row.parent.classList.remove('current');
			row.node.style.backgroundColor = '';
			row.isNext = false;
			// Next Chapter is 0 if it exists and it's a new Title or the first next closest
			const isOpened = title.chapters.indexOf(row.chapter) >= 0;
			if (
				!foundNext &&
				((row.chapter > title.progress.chapter && row.chapter < Math.floor(title.progress.chapter) + 2) ||
					(row.chapter == 0 && title.progress.chapter == 0 && title.status !== Status.COMPLETED))
			) {
				row.node.style.backgroundColor = Options.colors.nextChapter;
				row.isNext = true;
				foundNext = true;
			} else if (isOpened) {
				row.node.style.backgroundColor = Options.colors.openedChapter;
			}
			// Set current state of the Toggle button
			if (row.toggleButton && row.toggleIcon) {
				if (isOpened) {
					row.toggleButton!.title = 'Remove from chapter list';
					row.toggleIcon!.classList.add('fa-minus');
					row.toggleIcon!.classList.remove('fa-plus');
				} else {
					row.toggleButton!.title = 'Add to chapter list';
					row.toggleIcon!.classList.add('fa-plus');
					row.toggleIcon!.classList.remove('fa-minus');
				}
			}
			// Add Set Latest button
			if (row.chapter == title.progress.chapter) {
				row.parent.classList.add('current');
			}
		}
	}
}

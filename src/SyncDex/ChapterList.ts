import { Options } from '../Core/Options';
import { ChapterRow } from './ChapterRow';
import { SyncModule } from '../Core/SyncModule';
import { LocalTitle } from '../Core/Title';

/**
 * Helper class for the chapter list in a Title Page
 */
export class ChapterList {
	highest: number = 0;
	rows: ChapterRow[] = [];
	languageMap: { [key: string]: string } = {};
	rowLanguages: { code: string; node: HTMLElement }[] = [];

	/**
	 * Find each rows, their previous/next and add CSS for animations
	 */
	constructor() {
		const chapterRows = document.querySelectorAll<HTMLElement>('.chapter-row');
		for (const row of chapterRows) {
			if (row.dataset.id == undefined) continue;
			const chapterRow = new ChapterRow(row);
			if (!isNaN(chapterRow.progress.chapter)) {
				this.rows.unshift(chapterRow);
				// Calculate highest chapter
				if (chapterRow.progress.chapter > this.highest) this.highest = chapterRow.progress.chapter;
			}
		}
	}

	bind(syncModule: SyncModule): void {
		const title = syncModule.title;
		for (const row of this.rows) {
			row.addManageButtons();

			// Bind chapter list button -- saveOpenedChapters is enabled if it exist
			row.toggleButton?.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.toggleIcon!.classList.contains('fa-minus')) {
					title.removeChapter(row.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter == row.progress.chapter) {
							if (!otherRow.isNext) otherRow.node.style.backgroundColor = '';
							otherRow.disableToggleButton();
						}
					}
				} else {
					title.addChapter(row.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter == row.progress.chapter) {
							if (!otherRow.isNext) otherRow.node.style.backgroundColor = Options.colors.openedChapter;
							otherRow.enableToggleButton();
						}
					}
				}
				await title.persist();
			});

			// Bind Set as Latest button
			let loading = false;
			row.markButton.addEventListener('click', async (event) => {
				event.preventDefault();
				if (loading) return;
				row.markButton.classList.add('loading');
				loading = true;
				if (row.progress.chapter == title.progress.chapter) return;
				const previousState = syncModule.saveState();
				const completed = title.setProgress(row.progress);
				// No need to do anything here, only add or remove chapters from the list
				// Highlight on syncedLocal will fix everything
				if (Options.saveOpenedChapters) {
					title.updateChapterList(row.progress.chapter);
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter < row.progress.chapter) {
							title.addChapter(otherRow.progress.chapter);
						}
					}
				}
				if (Options.biggerHistory) {
					await title.setHistory(row.chapterId);
				}
				await title.persist();
				syncModule.overview?.syncedLocal(title);
				const report = await syncModule.syncExternal(true);
				syncModule.displayReportNotifications(report, { completed: completed }, previousState);
				row.markButton.classList.remove('loading');
				loading = false;
			});
		}
	}

	highlight(title: LocalTitle): void {
		let foundNext = false;
		let nextChapterValue = 0;
		for (const row of this.rows) {
			// Reset
			row.parent.classList.remove('current');
			row.node.style.backgroundColor = '';
			row.isNext = false;
			// Next Chapter is 0 if it exists and it's a new Title or the first next closest
			const isOpened = title.chapters.indexOf(row.progress.chapter) >= 0;
			if (
				(!foundNext &&
					((row.progress.chapter > title.progress.chapter &&
						row.progress.chapter < Math.floor(title.progress.chapter) + 2) ||
						(row.progress.chapter == 0 &&
							title.progress.chapter == 0 &&
							title.status !== Status.COMPLETED))) ||
				(foundNext && nextChapterValue === row.progress.chapter)
			) {
				// * Next Chapter
				row.node.style.backgroundColor = Options.colors.nextChapter;
				row.isNext = true;
				foundNext = true;
				nextChapterValue = row.progress.chapter;
			} else if (title.progress.chapter == row.progress.chapter) {
				// * Current chapter
				row.node.style.backgroundColor = Options.colors.highlights[0];
			} else if (isOpened) {
				// * Opened Chapter
				row.node.style.backgroundColor = Options.colors.openedChapter;
			}
			// Set current state of the Toggle button
			if (row.toggleButton && row.toggleIcon) {
				if (isOpened) {
					row.enableToggleButton();
				} else {
					row.disableToggleButton();
				}
			}
			// Hide Set Latest button
			if (row.progress.chapter == title.progress.chapter) {
				row.parent.classList.add('current');
			}
		}
	}
}

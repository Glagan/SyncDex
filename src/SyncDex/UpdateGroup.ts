import { Options } from '../Core/Options';
import { stringToProgress } from '../Core/Utility';
import { Title } from '../Core/Title';

interface ChapterRow {
	node: HTMLElement;
	progress?: Progress;
}

/**
 * Helper class to get and easily highlight or hide chapters and titles in the Updates page.
 */
export class UpdateGroup {
	id: number = 0;
	titleRow: HTMLTableDataCellElement;
	chapters: ChapterRow[] = [];
	static currentColor: number = 0;

	constructor(id: number, titleRow: HTMLTableDataCellElement) {
		this.id = id;
		this.titleRow = titleRow;
	}

	hide = (title: Title): void => {
		const progress = title.progress;
		let chapterCount = this.chapters.length;
		let hidden = 0;
		let foundNext = false;
		for (const row of this.chapters) {
			if (!row.progress) continue;
			// If it's the next chapter do nothing and skip it
			const isNextChapter =
				!foundNext &&
				((row.progress.chapter > progress.chapter && row.progress.chapter < Math.floor(progress.chapter) + 2) ||
					(row.progress.chapter == 0 && progress.chapter == 0 && title.status !== Status.COMPLETED));
			if (isNextChapter) {
				foundNext = true;
				continue;
			}
			// Hide row if it matches any option
			if (
				(Options.hideHigher && row.progress.chapter > progress.chapter) ||
				(Options.hideLower && row.progress.chapter < progress.chapter) ||
				(Options.hideLast && progress.chapter == row.progress.chapter)
			) {
				row.node.className = 'hidden full';
				hidden++;
			}
		}
		// If everything is hidden hide the first row
		if (hidden == chapterCount) {
			this.titleRow.className = 'hidden full';
		}
		const firstRowColumn = this.titleRow.firstElementChild as HTMLTableDataCellElement;
		const newSpan = chapterCount - hidden + 1;
		if (newSpan != firstRowColumn.rowSpan) {
			firstRowColumn.dataset.originalSpan = `${firstRowColumn.rowSpan}`;
			firstRowColumn.rowSpan = newSpan;
		}
	};

	highlight = (title: Title): void => {
		const progress = title.progress;
		let lastColor = Options.colors.highlights.length;
		let foundNext = false;
		// If there is data
		const bgColumn = this.titleRow.firstElementChild as HTMLElement;
		for (const row of this.chapters) {
			if (!row.progress) continue;
			row.node.classList.add('has-fast-in-transition');
			if (
				!foundNext &&
				((row.progress.chapter > progress.chapter && row.progress.chapter < Math.floor(progress.chapter) + 2) ||
					(row.progress.chapter == 0 && progress.chapter == 0 && title.status !== Status.COMPLETED))
			) {
				// * Next Chapter
				foundNext = true;
				row.node.style.backgroundColor = Options.colors.nextChapter;
				bgColumn.style.backgroundColor = Options.colors.nextChapter;
			} else if (row.progress.chapter > progress.chapter) {
				// * Higher Chapter
				row.node.style.backgroundColor = Options.colors.higherChapter;
			} else if (row.progress.chapter < progress.chapter) {
				// * Lower Chapter
				row.node.style.backgroundColor = Options.colors.lowerChapter;
			} else if (progress.chapter == row.progress.chapter) {
				// * Current Chapter
				row.node.style.backgroundColor = Options.colors.highlights[UpdateGroup.currentColor];
				if (!foundNext) {
					bgColumn.style.backgroundColor = Options.colors.highlights[UpdateGroup.currentColor];
				}
			}
		}
		UpdateGroup.currentColor = (UpdateGroup.currentColor + 1) % lastColor;
	};

	static getGroups = (): UpdateGroup[] => {
		const groups: UpdateGroup[] = [];
		const rows = document.querySelectorAll<HTMLTableDataCellElement>('table tbody tr');
		let currentGroup: UpdateGroup | undefined = undefined;
		for (const row of rows) {
			const mangaTitle = row.querySelector<HTMLAnchorElement>('.manga_title');
			if (mangaTitle !== null) {
				if (currentGroup !== undefined) groups.push(currentGroup);
				const idReg = /\/(?:title|manga)\/(\d+)\/?/.exec(mangaTitle.href);
				if (idReg == null) {
					currentGroup = undefined;
					continue;
				}
				const id = parseInt(idReg[1]);
				currentGroup = new UpdateGroup(id, row);
			} else if (currentGroup != undefined) {
				const chapterLink = row.querySelector<HTMLAnchorElement>(`a[href^='/chapter/'`);
				if (!chapterLink) continue;
				const progress = stringToProgress(chapterLink.textContent!);
				if (!progress) continue;
				currentGroup.chapters.unshift({
					node: row,
					progress: progress,
				});
			}
		}
		return groups;
	};
}

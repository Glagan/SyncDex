import { Options } from '../../Core/Options';
import { TitleCollection } from '../../Core/Title';
import { Page } from '../Page';
import { progressFromString } from '../../Core/Utility';
import { Title } from '../../Core/Title';
import { DOM } from '../../Core/DOM';
import { TryCatch } from '../../Core/Log';

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
			// * Next Chapter
			if (
				!foundNext &&
				((row.progress.chapter > progress.chapter && row.progress.chapter < Math.floor(progress.chapter) + 2) ||
					(row.progress.chapter == 0 && progress.chapter == 0 && title.status !== Status.COMPLETED))
			) {
				foundNext = true;
				row.node.style.backgroundColor = Options.colors.nextChapter;
				bgColumn.style.backgroundColor = Options.colors.nextChapter;
			}
			// * Higher Chapter
			else if (row.progress.chapter > progress.chapter) {
				row.node.style.backgroundColor = Options.colors.higherChapter;
			}
			// * Lower Chapter
			else if (row.progress.chapter < progress.chapter) {
				row.node.style.backgroundColor = Options.colors.lowerChapter;
			}
			// * Current Chapter
			else if (progress.chapter == row.progress.chapter) {
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
				const progress = progressFromString(chapterLink.textContent!);
				if (isNaN(progress.chapter)) continue;
				currentGroup.chapters.unshift({
					node: row,
					progress: progress,
				});
			}
		}
		return groups;
	};
}

export class UpdatesPage extends Page {
	@TryCatch(Page.errorNotification)
	async run() {
		console.log('SyncDex :: Updates');

		if (!Options.hideHigher && !Options.hideLast && !Options.hideLower && !Options.highlight) return;

		const groups = UpdateGroup.getGroups();
		const ids = groups.map((group) => group.id);
		const titles = await TitleCollection.get(ids);

		// Hide or Highlight groups -- no need for Thumbnails
		for (const group of groups) {
			const title = titles.find(group.id);
			if (!title || !title.inList) continue;
			if (Options.hideHigher || Options.hideLast || Options.hideLower) group.hide(title);
			if (Options.highlight) group.highlight(title);
		}

		// Button to toggle hidden chapters
		const rows = document.querySelectorAll('.hidden');
		const hiddenCount = rows.length;
		const topBar = document.querySelector<HTMLElement>('h6.card-header')!;
		if (topBar && hiddenCount > 0) {
			const icon = DOM.icon('eye');
			const linkContent = DOM.create('span', { textContent: `Show Hidden ${hiddenCount}` });
			const button = DOM.create('button', {
				class: 'btn btn-secondary',
				childs: [icon, DOM.space(), linkContent],
			});
			let active = false;
			let shortenedTitles = document.querySelectorAll<HTMLTableDataCellElement>('td[data-original-span]');
			button.addEventListener('click', (event) => {
				event.preventDefault();
				rows.forEach((row) => {
					row.classList.toggle('visible');
				});
				shortenedTitles.forEach((row) => {
					const span = row.rowSpan;
					row.rowSpan = parseInt(row.dataset.originalSpan!);
					row.dataset.originalSpan = `${span}`;
				});
				icon.classList.toggle('fa-eye');
				icon.classList.toggle('fa-eye-slash');
				if (active) linkContent.textContent = `Show Hidden (${hiddenCount})`;
				else linkContent.textContent = `Hide Hidden (${hiddenCount})`;
				active = !active;
			});
			topBar.classList.add('top-bar-updates');
			topBar.appendChild(button);
		}
	}
}

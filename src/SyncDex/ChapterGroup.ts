import { DOM } from '../Core/DOM';
import { Options } from '../Core/Options';
import { Thumbnail } from './Thumbnail';
import { Title } from '../Core/Title';

interface ChapterRow {
	progress: Progress | undefined;
	node: HTMLElement;
	hidden: boolean;
}

export class ChapterGroup {
	id: number = 0;
	name: string = '';
	/**
	 * List of all chapter rows in the group, starting from the top.
	 */
	rows: ChapterRow[] = [];
	nextChapter: HTMLElement | undefined;
	static currentColor: number = 0;
	static titleGroups: { [key: number]: ChapterGroup[] } = {};

	constructor(id?: number, name?: string) {
		if (id) this.id = id;
		if (name) this.name = name;
	}

	hide = (title: Title): void => {
		const progress = title.progress;
		let chapterCount = this.rows.length;
		for (const row of this.rows) {
			if (!row.progress) continue;
			// Hide Lower and Last, avoid hiding next Chapter (0 is the next of 0)
			if (
				(Options.hideHigher && row.progress.chapter > progress.chapter && this.nextChapter !== row.node) ||
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
					href: `/title/${this.id}`,
					title: this.name,
				});
				this.rows[j].node.firstElementChild?.appendChild(link);
			}
		}
	};

	highlight = (title: Title): void => {
		const progress = title.progress;
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
				if (this.nextChapter == row.node) {
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

	setThumbnails = (): void => {
		// Add events
		for (const group of this.rows) {
			new Thumbnail(this.id, group.node);
		}
	};

	findNextChapter = (title: Title): void => {
		const titleGroups = ChapterGroup.titleGroups[title.id];
		if (!titleGroups) return;
		const progress = title.progress;
		let lowestRow: [ChapterGroup, ChapterRow] | undefined = undefined;
		for (const group of titleGroups) {
			// Select the lowest next chapter of the group
			let lowestGroupRow: ChapterRow | undefined;
			for (const row of group.rows) {
				if (
					row.progress &&
					((row.progress.chapter > progress.chapter &&
						row.progress.chapter < Math.floor(progress.chapter) + 2) ||
						(row.progress.chapter == 0 && progress.chapter == 0 && title.status !== Status.COMPLETED)) &&
					(!lowestGroupRow || lowestGroupRow.progress!.chapter > row.progress.chapter)
				) {
					lowestGroupRow = row;
				}
			}
			// Select the lowest next chapter of the Title
			if (
				lowestGroupRow &&
				(lowestRow == undefined || lowestRow[1].progress!.chapter > lowestGroupRow.progress!.chapter)
			) {
				lowestRow = [group, lowestGroupRow];
			}
		}
		if (lowestRow) lowestRow[0].nextChapter = lowestRow[1].node;
	};

	static getGroups = (): ChapterGroup[] => {
		let chapterContainer = document.querySelector<HTMLElement>('.chapter-container');
		if (!chapterContainer) return [];
		let nodes = chapterContainer.children;
		let groups: ChapterGroup[] = [];
		if (nodes.length > 1) {
			let currentGroup = new ChapterGroup();
			for (const row of nodes) {
				const chapterRow = row.querySelector<HTMLElement>('[data-chapter]');
				const firstChild = row.firstElementChild!;
				if (chapterRow && chapterRow.dataset.mangaId && firstChild) {
					const id = Math.floor(parseInt(chapterRow.dataset.mangaId));
					const isFirstRow = firstChild && firstChild.childElementCount > 0;
					// Is this is a new entry push the current group and create a new one
					if (isFirstRow) {
						if (currentGroup.rows.length > 0) {
							if (!ChapterGroup.titleGroups[currentGroup.id]) {
								ChapterGroup.titleGroups[currentGroup.id] = [];
							}
							ChapterGroup.titleGroups[currentGroup.id].push(currentGroup);
							groups.push(currentGroup);
						}
						currentGroup = new ChapterGroup(id, firstChild.textContent!.trim());
					}
					const chapter: ChapterRow = {
						progress: (() => {
							const oneshot = chapterRow.dataset.title == 'Oneshot';
							return {
								chapter: oneshot ? 0 : parseFloat(chapterRow.dataset.chapter!),
								volume: parseFloat(chapterRow.dataset?.volume || '') || undefined,
								oneshot: oneshot,
							};
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
				if (!ChapterGroup.titleGroups[currentGroup.id]) {
					ChapterGroup.titleGroups[currentGroup.id] = [];
				}
				ChapterGroup.titleGroups[currentGroup.id].push(currentGroup);
				groups.push(currentGroup);
			}
		}
		return groups;
	};
}

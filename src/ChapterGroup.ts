import { DOM } from './DOM';
import { Options } from './Options';
import { ActivableKey } from './Title';
import { Thumbnail } from './Thumbnail';

interface ChapterRow {
	progress: Progress | undefined;
	node: HTMLElement;
	hidden: boolean;
}

class ChapterGroup {
	id: number = 0;
	name: string = '';
	/**
	 * List of all chapter rows in the group, starting from the top.
	 */
	rows: ChapterRow[] = [];
	static currentColor: number = 0;

	constructor(id?: number, name?: string) {
		if (id) this.id = id;
		if (name) this.name = name;
	}

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
					href: `/title/${this.id}`,
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

	setThumbnails = (): void => {
		// Add events
		for (const group of this.rows) {
			new Thumbnail(this.id, group.node);
		}
	};
}

export class MangaDex {
	document: Document;

	constructor(document: Document) {
		this.document = document;
	}

	getChapterGroups = (): ChapterGroup[] => {
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
					let id = Math.floor(parseInt(chapterRow.dataset.mangaId));
					let isFirstRow = firstChild && firstChild.childElementCount > 0;
					// Is this is a new entry push the current group and create a new one
					if (isFirstRow) {
						if (currentGroup.rows.length > 0) {
							groups.push(currentGroup);
						}
						currentGroup = new ChapterGroup(id, firstChild.textContent!.trim());
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

	static iconToService(src: string): ActivableKey | undefined {
		const key = /https:\/\/(?:www\.)?mangadex\.org\/images\/misc\/(.+)\.png/.exec(src);
		if (key == null) return undefined;
		switch (key[1]) {
			case 'mal':
			case 'al':
			case 'ap':
			case 'mu':
				return key[1] as ActivableKey;
			case 'kt':
				return ActivableKey.Kitsu;
		}
		return undefined;
	}
}

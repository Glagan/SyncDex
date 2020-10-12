import { DOM } from '../Core/DOM';
import { Options } from '../Core/Options';
import { Thumbnail } from './Thumbnail';
import { Title } from '../Core/Title';
import { ChapterRow } from './ChapterRow';
import { SyncModule } from '../Core/SyncModule';

export class TitleChapterGroup {
	id: number = 0;
	name: string = '';
	hiddenRows: number = 0;
	/**
	 * List of all chapter rows for the Title.
	 */
	rows: ChapterRow[] = [];
	/**
	 * List of all groups for the Title.
	 */
	groups: ChapterRow[][] = [];
	nextChapters: ChapterRow[] = [];
	nextChapterRows: HTMLElement[] = [];
	initializedSync: boolean = false;
	thumbnail?: Thumbnail;

	/**
	 * List of rows for each rows indexed by a MangaDex Title ID
	 */
	static titleGroups: { [key: number]: TitleChapterGroup } = {};
	static currentColor: number = 0;
	static totalHiddenRows: number = 0;
	static toggleButton = (() => {
		const icon = DOM.icon('eye');
		const description = DOM.create('span', { textContent: 'Show Hidden' });
		const value = DOM.create('span', { textContent: '0' });
		return {
			totalHidden: 0,
			icon: icon,
			description: description,
			value: value,
			button: DOM.create('li', {
				class: 'nav-item',
				childs: [
					DOM.create('a', {
						class: 'nav-link',
						href: '#',
						childs: [icon, DOM.space(), description, DOM.space(), DOM.text('('), value, DOM.text(')')],
					}),
				],
			}),
		};
	})();

	constructor(id: number, name: string) {
		this.id = id;
		this.name = name;
	}

	titleLink = (): HTMLElement => {
		return DOM.create('a', {
			textContent: this.name,
			class: 'text-truncate',
			href: `/title/${this.id}`,
			title: this.name,
		});
	};

	/**
	 * Find the next chapter for the group if it's available and bind events.
	 * Also add required CSS to each rows.
	 */
	initialize = (syncModule: SyncModule): void => {
		this.findNextChapter(syncModule.title);
		const title = syncModule.title;

		// Add back the name on the first row
		for (const group of this.groups) {
			if (group.length > 0) {
				group[0].node.firstElementChild!.appendChild(this.titleLink());

				// Bind each row and add current chapter class
				for (const row of group) {
					row.addManageButtons();
					if (Options.thumbnail) this.thumbnail = new Thumbnail(this.id, row.node, title);
					if (row.progress.chapter == title.progress.chapter) {
						row.parent.classList.add('current');
					}
					row.node.classList.add('has-fast-in-transition');

					if (row.toggleButton && row.toggleIcon) {
						// Set default toggleButton state
						if (title.chapters.indexOf(row.progress.chapter) >= 0) {
							row.enableToggleButton();
						} else {
							row.disableToggleButton();
						}

						// Bind chapter list button -- saveOpenedChapters is enabled if it exist
						row.toggleButton.addEventListener('click', async (event) => {
							event.preventDefault();
							if (row.toggleIcon!.classList.contains('fa-minus')) {
								title.removeChapter(row.progress.chapter);
								// Toggle all rows with the same chapter value
								for (const otherRow of this.rows) {
									if (otherRow.progress.chapter == row.progress.chapter) {
										otherRow.disableToggleButton();
									}
								}
							} else {
								title.addChapter(row.progress.chapter);
								// Toggle all rows with the same chapter value
								for (const otherRow of this.rows) {
									if (otherRow.progress.chapter == row.progress.chapter) {
										otherRow.enableToggleButton();
									}
								}
							}
						});
					}

					// Bind Set as Latest button
					row.markButton.addEventListener('click', async (event) => {
						event.preventDefault();
						if (!this.initializedSync) {
							syncModule?.initialize();
							await syncModule.syncLocal();
							this.initializedSync = true;
						}
						if (row.progress.chapter == title.progress.chapter) return;
						row.parent.classList.add('current');
						// No need to do anything here, only add or remove chapters from the list
						// Highlight will fix everything
						if (Options.saveOpenedChapters) {
							title.updateChapterList(row.progress.chapter);
							// Update visible rows and add possible subchapters to the chapter list
							for (const otherRow of this.rows) {
								if (otherRow.progress.chapter > row.progress.chapter) {
									otherRow.parent.classList.remove('current');
									row.disableToggleButton();
								} else if (otherRow.progress.chapter < row.progress.chapter) {
									otherRow.parent.classList.remove('current');
									title.addChapter(otherRow.progress.chapter);
									row.enableToggleButton();
								} else {
									otherRow.parent.classList.add('current');
									row.enableToggleButton();
								}
							}
						}
						// Update Title
						title.progress.chapter = row.progress.chapter;
						if (title.status == Status.NONE) {
							title.status = Status.READING;
							title.start = new Date();
						}
						await title.persist();
						this.findNextChapter(title);
						if (Options.highlight) this.highlight(title);
						if (Options.hideHigher || Options.hideLast || Options.hideLower) this.hide(title);
						if (Options.progressInThumbnail) this.thumbnail?.updateContent(title);
						await syncModule!.syncExternal(true);
					});
				}
			}
		}
	};

	toggleHidden = (hidden: boolean): void => {
		for (const group of this.groups) {
			if (group.length == 0) continue;
			let addedTitle = false;
			for (const row of group) {
				row.node.firstElementChild!.textContent = '';
				if (row.hidden) {
					row.node.classList.toggle('visible');
				}
				// Add back title in the first column
				if (
					!addedTitle &&
					(!hidden || !row.hidden) &&
					(!Options.separateLanguages || row.node.classList.contains('visible-lang'))
				) {
					row.node.firstElementChild!.appendChild(this.titleLink());
					addedTitle = true;
				}
			}
		}
	};

	hide = (title: Title): void => {
		TitleChapterGroup.totalHiddenRows -= this.hiddenRows;
		this.hiddenRows = 0;
		const progress = title.progress;
		const showHidden = TitleChapterGroup.toggleButton.button.classList.contains('show-hidden');
		for (const group of this.groups) {
			if (group.length == 0) continue;
			let addedTitle = false;
			for (const row of group) {
				if (!row.progress) continue;
				// Reset
				row.hidden = false;
				row.node.classList.remove('hidden', 'visible');
				row.node.firstElementChild!.textContent = '';
				// Hide Lower and Last, avoid hiding next Chapter (0 is the next of 0)
				if (
					(Options.hideHigher &&
						row.progress.chapter > progress.chapter &&
						this.nextChapterRows.indexOf(row.node) < 0) ||
					(Options.hideLower && row.progress.chapter < progress.chapter) ||
					(Options.hideLast && progress.chapter == row.progress.chapter)
				) {
					row.node.classList.add('hidden');
					if (showHidden) row.node.classList.add('visible');
					row.hidden = true;
					this.hiddenRows++;
				}
				// Add back title in the first column
				if (
					!addedTitle &&
					!row.hidden &&
					(!Options.separateLanguages || row.node.classList.contains('visible-lang'))
				) {
					row.node.firstElementChild!.appendChild(this.titleLink());
					addedTitle = true;
				}
			}
		}
		TitleChapterGroup.totalHiddenRows += this.hiddenRows;
		TitleChapterGroup.toggleButton.value.textContent = `${TitleChapterGroup.totalHiddenRows}`;
	};

	highlight = (title: Title): void => {
		const progress = title.progress;
		let lastColor = Options.colors.highlights.length;
		for (const group of this.groups) {
			// index of the next or current chapter in the group
			let selected = -1;
			let foundNext = false;
			let outerColor = Options.colors.highlights[TitleChapterGroup.currentColor];
			// If there is data
			let chapterCount = group.length;
			for (let j = 0; j < chapterCount; j++) {
				let row = group[j];
				// Reset
				row.node.style.backgroundColor = '';
				(row.node.firstElementChild as HTMLElement).style.backgroundColor = '';
				if (row.progress) {
					if (this.nextChapterRows.indexOf(row.node) >= 0) {
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
						row.node.style.backgroundColor = Options.colors.highlights[TitleChapterGroup.currentColor];
						if (!foundNext) selected = j;
					}
				}
			}
			if (selected >= 0) {
				for (let j = 0; j < chapterCount; j++) {
					if (j == selected) break;
					if (group[j].progress && group[j].progress?.chapter == group[selected].progress?.chapter) continue;
					(group[j].node.firstElementChild as HTMLElement).style.backgroundColor = outerColor;
				}
			}
		}
		TitleChapterGroup.currentColor = (TitleChapterGroup.currentColor + 1) % lastColor;
	};

	findNextChapter = (title: Title): void => {
		this.nextChapters = [];
		const progress = title.progress;
		let lowestProgress: Progress | undefined = undefined;
		// Select the lowest next chapter of the group
		for (const row of this.rows) {
			if (
				row.progress &&
				((row.progress.chapter > progress.chapter && row.progress.chapter < Math.floor(progress.chapter) + 2) ||
					(row.progress.chapter == 0 && progress.chapter == 0 && title.status !== Status.COMPLETED)) &&
				(!lowestProgress || lowestProgress.chapter > row.progress.chapter)
			) {
				lowestProgress = row.progress;
				this.nextChapters = [row];
			} else if (lowestProgress && lowestProgress.chapter === row.progress.chapter) {
				this.nextChapters.push(row);
			}
		}
		// Set isNext and add to the nextChapterRows for easy node access
		this.nextChapterRows = [];
		for (const row of this.nextChapters) {
			row.isNext = true;
			this.nextChapterRows.push(row.node);
		}
	};

	static getGroups = (): TitleChapterGroup[] => {
		const groups: TitleChapterGroup[] = [];
		let fullRows = document.querySelectorAll<HTMLElement>('.chapter-container > .row');
		if (fullRows.length > 1) {
			let currentTitleGroup: TitleChapterGroup | undefined;
			let currentChapterGroup: ChapterRow[] = [];
			for (const row of fullRows) {
				const chapterRow = row.querySelector<HTMLElement>('.chapter-row');
				if (!chapterRow || !chapterRow.dataset.mangaId) continue;
				const firstChild = row.firstElementChild;
				if (firstChild) {
					const id = Math.floor(parseInt(chapterRow.dataset.mangaId));
					const isFirstRow = firstChild && firstChild.childElementCount > 0;
					// Is this is a new entry push the current group and create a new one
					if (!currentTitleGroup || isFirstRow) {
						if (!TitleChapterGroup.titleGroups[id]) {
							currentTitleGroup = new TitleChapterGroup(id, firstChild.textContent!.trim());
							TitleChapterGroup.titleGroups[id] = currentTitleGroup;
							groups.push(currentTitleGroup);
							currentChapterGroup = [];
							currentTitleGroup.groups.push(currentChapterGroup);
						} else {
							currentTitleGroup = TitleChapterGroup.titleGroups[id];
							if (Options.groupTitlesInLists) {
								currentChapterGroup = currentTitleGroup.groups[0];
							} else {
								currentChapterGroup = [];
								currentTitleGroup.groups.push(currentChapterGroup);
							}
						}
					}
					const currentChapterRow = new ChapterRow(chapterRow);
					// Don't add empty chapters
					if (!isNaN(currentChapterRow.progress.chapter)) {
						firstChild.textContent = '';
						// Move the chapters to a single group
						if (Options.groupTitlesInLists) {
							const max = currentChapterGroup.length;
							if (max > 0) {
								let i = 0;
								for (; i < max; i++) {
									const otherRow = currentChapterGroup[i];
									if (currentChapterRow.progress.chapter > otherRow.progress.chapter) {
										otherRow.node.parentElement!.insertBefore(
											currentChapterRow.node,
											otherRow.node
										);
										currentChapterGroup.splice(i, 0, currentChapterRow);
										break;
									}
								}
								// If the chapter is not higher it's the lower one and it's last
								if (i == max) {
									currentChapterGroup[max - 1].node.parentElement!.insertBefore(
										currentChapterRow.node,
										currentChapterGroup[max - 1].node.nextElementSibling
									);
									currentChapterGroup.push(currentChapterRow);
								}
							} else currentChapterGroup.push(currentChapterRow);
						} else {
							currentChapterGroup.push(currentChapterRow);
						}
						currentTitleGroup.rows.push(currentChapterRow);
					}
				}
			}
		}
		return groups;
	};
}

import { Options } from '../../Core/Options';
import { Page } from '../Page';
import { DOM } from '../../Core/DOM';
import { Thumbnail } from '../Thumbnail';
import { LocalTitle, TitleCollection } from '../../Core/Title';
import { ChapterRow } from '../ChapterRow';
import { SyncModule } from '../../Core/SyncModule';
import { TryCatch } from '../../Core/Log';
import { listen } from '../../Core/Event';

class TitleChapterGroup {
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
	isH: boolean = false;

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

	constructor(id: number, titleColumn: Element) {
		this.id = id;
		this.name = titleColumn.querySelector('a')!.textContent!.trim();
		this.isH = titleColumn.querySelector('span.badge.badge-danger') != null;
	}

	addTitleLinkToRow = (row: ChapterRow): void => {
		if (!row.node.firstElementChild) return;
		row.node.firstElementChild.appendChild(
			DOM.create('a', {
				textContent: this.name,
				class: 'text-truncate',
				href: `/title/${this.id}`,
				title: this.name,
			})
		);
		if (this.isH) {
			row.node.firstElementChild.appendChild(
				DOM.create('span', { class: 'badge badge-danger ml-1', textContent: 'H' })
			);
		}
	};

	updateDisplayedRows = (title: LocalTitle) => {
		if (Options.highlight) this.highlight(title);
		if (Options.hideHigher || Options.hideLast || Options.hideLower) this.hide(title);
		if (Options.progressInThumbnail) this.thumbnail?.updateContent(title);
		if (Options.saveOpenedChapters) {
			for (const row of this.rows) {
				row.parent.classList.remove('current');
				if (title.chapters.indexOf(title.chapter) < 0) {
					row.disableToggleButton();
				} else row.enableToggleButton();
				if (row.progress.chapter == title.chapter) {
					row.parent.classList.add('current');
				}
			}
		}
	};

	/**
	 * Find the next chapter for the group if it's available and bind events.
	 * Also add required CSS to each rows.
	 */
	initialize = (syncModule: SyncModule): void => {
		const title = syncModule.title;

		// Add back the name on the first row
		for (const group of this.groups) {
			if (group.length > 0) {
				this.addTitleLinkToRow(group[0]);

				// Bind each row and add current chapter class
				for (const row of group) {
					if (title.volumeResetChapter) {
						// TODO: ? Add warning or update from API if lastTitle || lastRead < chapter release
						// 		to avoid new volume gap from incorrect previous volume real length
						title.updateProgressFromVolumes(row.progress);
						row.updateDisplayedProgress();
						// ! Can't update progress with previous since a previous might not be available
						// This means no Vol. 1 Ch. 14 -> Vol. 2 Ch.0 as Vol. 2 Ch. 14.1
					}
					row.addManageButtons();
					if (Options.thumbnail) this.thumbnail = Thumbnail.bind(this.id, row.node, title);
					if (row.progress.chapter == title.chapter) {
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
							await title.persist();
						});
					}

					// Bind Set as Latest button
					row.markButton.addEventListener('click', async (event) => {
						event.preventDefault();
						if (row.progress.chapter == title.chapter) return;

						if (!this.initializedSync) {
							syncModule?.initialize();
							await syncModule.syncLocal();
							this.initializedSync = true;
						}

						// Update to current row progress
						row.markButton.classList.add('loading');
						await syncModule.syncProgress(row.progress);
						row.markButton.classList.remove('loading');

						// Always update History
						if (Options.biggerHistory) {
							await title.setHistory(row.chapterId);
							await title.persist();
						}

						// Add possible subchapters to the chapter list
						if (Options.saveOpenedChapters) {
							let updated = false;
							for (const otherRow of this.rows) {
								if (otherRow.progress.chapter < row.progress.chapter) {
									title.addChapter(otherRow.progress.chapter);
									updated = true;
								}
							}
							if (updated) {
								await title.persist();
							}
						}

						// Update Group
						this.findNextChapter(title);
						this.updateDisplayedRows(title);
					});
				}
			}
		}

		this.findNextChapter(title);
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
					this.addTitleLinkToRow(row);
					addedTitle = true;
				}
			}
		}
	};

	hide = (title: LocalTitle): void => {
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
					this.addTitleLinkToRow(row);
					addedTitle = true;
				}
			}
		}
		TitleChapterGroup.totalHiddenRows += this.hiddenRows;
		TitleChapterGroup.toggleButton.value.textContent = `${TitleChapterGroup.totalHiddenRows}`;
	};

	highlight = (title: LocalTitle): void => {
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
					// * Next Chapter
					if (this.nextChapterRows.indexOf(row.node) >= 0) {
						row.node.style.backgroundColor = Options.colors.nextChapter;
						selected = j;
						foundNext = true;
						outerColor = Options.colors.nextChapter;
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

	findNextChapter = (title: LocalTitle): void => {
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
					const id = parseInt(chapterRow.dataset.mangaId);
					const isFirstRow = firstChild && firstChild.childElementCount > 0;
					// Is this is a new entry push the current group and create a new one
					if (!currentTitleGroup || isFirstRow) {
						if (!TitleChapterGroup.titleGroups[id]) {
							currentTitleGroup = new TitleChapterGroup(id, firstChild);
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

export class ChapterListPage extends Page {
	@TryCatch(Page.errorNotification)
	async run() {
		console.log('SyncDex :: Chapter List');

		if (!Options.hideHigher && !Options.hideLast && !Options.hideLower && !Options.thumbnail && !Options.highlight)
			return;

		const groups = TitleChapterGroup.getGroups();
		const titles = await TitleCollection.get([...new Set(groups.map((group) => group.id))]);

		// Check MangaDex login status
		const loggedIn = document.querySelector(`a.nav-link[href^='/user']`) !== null;
		// Hide, Highlight and add Thumbnails to each row
		for (const group of groups) {
			const title = titles.find(group.id);
			if (title !== undefined && title.inList) {
				const syncModule = new SyncModule('list', title);
				syncModule.loggedIn = loggedIn;
				group.initialize(syncModule);
				group.updateDisplayedRows(title);
			} else if (group.rows.length > 0) {
				// Still add thumbnails and the Group title if it's no in list
				if (Options.thumbnail) {
					for (const row of group.rows) {
						Thumbnail.bind(group.id, row.node, title);
					}
				}
				group.addTitleLinkToRow(group.rows[0]);
			}
		}
		// Add listener for cancel button after "Set Latest" progress update
		// 	Find the group and update displayed rows back to the previous progress
		listen('sync:end', (payload) => {
			if (payload.type !== 'cancel') return;
			const title = payload.syncModule.title;
			for (const group of groups) {
				if (group.id == payload.syncModule.title.key.id) {
					group.findNextChapter(title);
					group.updateDisplayedRows(title);
					break;
				}
			}
		});

		// Button to toggle hidden chapters
		const navBar = document.querySelector<HTMLElement>('#content ul.nav.nav-tabs');
		if (navBar) {
			if (!navBar.classList.contains('hide-loaded')) {
				navBar.classList.add('hide-loaded');
				const toggleButton = TitleChapterGroup.toggleButton;
				toggleButton.button.addEventListener('click', (event) => {
					event.preventDefault();
					let hidden = !toggleButton.button.classList.toggle('show-hidden');
					for (const group of groups) {
						group.toggleHidden(hidden);
					}
					toggleButton.icon.classList.toggle('fa-eye');
					toggleButton.icon.classList.toggle('fa-eye-slash');
					if (hidden) toggleButton.description.textContent = 'Show Hidden';
					else toggleButton.description.textContent = 'Hide Hidden';
				});
				if (navBar.lastElementChild!.classList.contains('ml-auto')) {
					navBar.insertBefore(toggleButton.button, navBar.lastElementChild);
				} else {
					navBar.appendChild(toggleButton.button);
				}
			}

			// Add Language buttons
			ChapterRow.generateLanguageButtons(
				navBar,
				(parent, tab) => {
					parent.insertBefore(tab, parent.lastElementChild);
				},
				() => {
					// Add the Title name in the first column after toggling languages
					let rawVisible = TitleChapterGroup.toggleButton.button.classList.contains('show-hidden');
					for (const titleGroup of groups) {
						for (const group of titleGroup.groups) {
							let addedTitle = false;
							for (const row of group) {
								row.node.firstElementChild!.textContent = '';
								if (
									!addedTitle &&
									(rawVisible || !row.hidden) &&
									row.node.classList.contains('visible-lang')
								) {
									titleGroup.addTitleLinkToRow(row);
									addedTitle = true;
								}
							}
						}
					}
				}
			);
		}
	}
}

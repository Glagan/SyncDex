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
	progress: Progress;
	language?: string;
}

export class ChapterList {
	highest: number = 0;
	rows: ChapterRow[] = [];
	languageMap: { [key: string]: string } = {};
	rowLanguages: { code: string; node: HTMLElement }[] = [];

	// Find each rows, their previous/next and add CSS for animations
	constructor() {
		const chapterRows = document.querySelectorAll<HTMLElement>('.chapter-row');
		let previousRow: ChapterRow | undefined;
		for (const row of chapterRows) {
			const fullRow = row.parentElement!.parentElement!;
			const chapter = row.dataset.title == 'Oneshot' ? 0 : parseFloat(row.dataset.chapter!);
			if (!isNaN(chapter)) {
				// Add CSS
				const parentRow = row.querySelector(`a[href^='/chapter']`)!.parentElement!;
				parentRow.classList.add('title-column');
				fullRow.classList.add('has-transition');
				fullRow.style.backgroundColor = '';

				// Save to the list
				const chapterRow: ChapterRow = {
					next: previousRow,
					isNext: false,
					node: fullRow,
					parent: parentRow,
					manage: DOM.create('div'),
					progress: { chapter: chapter },
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

				// Find lang
				if (Options.separateLanguages) {
					const flag = row.querySelector<HTMLImageElement>('.flag');
					if (flag) {
						const code = /flag-(\w+)/.exec(flag.className);
						if (code) {
							this.rowLanguages.push({ code: code[1], node: fullRow });
							this.languageMap[code[1]] = flag.title;
							flag.title = `${flag.title} [${code[1]}]`;
							fullRow.classList.add('hidden-lang', 'visible-lang');
						}
					}
				}

				this.rows.unshift(chapterRow);
				previousRow = chapterRow;
				// Calculate highest chapter
				if (chapter > this.highest) this.highest = chapter;
			}
		}

		// Add Language list
		const navTabs = document.querySelector<HTMLElement>('ul.edit.nav.nav-tabs');
		const langLoaded = navTabs ? navTabs.classList.contains('loaded') : true;
		if (Options.separateLanguages && navTabs && !langLoaded) {
			navTabs.classList.add('loaded');

			// Find defaultLanguage
			const availableLanguages = Object.keys(this.languageMap);
			const hasWantedLanguage = availableLanguages.includes(Options.favoriteLanguage);
			const defaultLanguage = hasWantedLanguage ? Options.favoriteLanguage : 'all';

			// Update style to fix tab height
			for (const tab of navTabs.children) {
				(tab as HTMLElement).style.display = 'flex';
			}

			// Add languages buttons
			let currentTab: HTMLElement | undefined = undefined;
			const hideAllExcept = (flag: string, tab: HTMLElement): void => {
				for (const row of this.rowLanguages) {
					if (flag == 'all' || row.code == flag) {
						row.node.classList.add('visible-lang');
					} else {
						row.node.classList.remove('visible-lang');
					}
				}
				if (currentTab) currentTab.classList.remove('active');
				currentTab = tab;
				currentTab.classList.add('active');
			};
			const createTab = (parent: HTMLElement, flag: string, name: string, title: string): HTMLElement => {
				const tabLink = DOM.create('a', {
					class: `nav-link tab-${flag} ${flag == Options.favoriteLanguage ? 'active' : ''}`,
					href: '#',
					title: title,
					events: {
						click: (event) => {
							event.preventDefault();
							hideAllExcept(flag, tabLink);
						},
					},
					childs: [
						DOM.create('span', { class: `rounded flag flag-${flag}`, childs: [] }),
						DOM.space(),
						DOM.create('span', {
							class: 'd-none d-md-inline',
							textContent: name,
						}),
					],
				});
				const tab = DOM.create('li', {
					class: 'nav-item',
					childs: [tabLink],
				});
				parent.appendChild(tab);
				return tab;
			};
			const allTab = createTab(navTabs, 'all', 'All Languages', 'Display chapters in all Languages');
			if (defaultLanguage == 'all') hideAllExcept(defaultLanguage, allTab);
			for (const language of availableLanguages) {
				const tab = createTab(
					navTabs,
					language,
					this.languageMap[language],
					`Show only chapters in ${this.languageMap[language]}`
				);
				if (language == defaultLanguage) hideAllExcept(defaultLanguage, tab);
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
						title.removeChapter(row.progress.chapter);
						// Toggle all rows with the same chapter value
						for (const otherRow of this.rows) {
							if (otherRow.progress.chapter == row.progress.chapter) {
								if (!otherRow.isNext) otherRow.node.style.backgroundColor = '';
								otherRow.toggleButton!.title = 'Add to chapter list';
								otherRow.toggleIcon!.classList.remove('fa-minus');
								otherRow.toggleIcon!.classList.add('fa-plus');
							}
						}
					} else {
						title.addChapter(row.progress.chapter);
						// Toggle all rows with the same chapter value
						for (const otherRow of this.rows) {
							if (otherRow.progress.chapter == row.progress.chapter) {
								if (!otherRow.isNext)
									otherRow.node.style.backgroundColor = Options.colors.openedChapter;
								otherRow.toggleButton!.title = 'Remove from chapter list';
								otherRow.toggleIcon!.classList.add('fa-minus');
								otherRow.toggleIcon!.classList.remove('fa-plus');
							}
						}
					}
					await title.persist();
				});
			}
			// Bind the 'Set as Latest' button
			row.markButton.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.progress.chapter == title.progress.chapter) return;
				// Remove everything above current -- highligth and from opened
				let higherRow = row;
				while (higherRow.next && higherRow.next.progress.chapter <= title.progress.chapter) {
					title.removeChapter(higherRow.next.progress.chapter);
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
					title.addChapter(currentRow.progress.chapter);
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
				title.progress.chapter = row.progress.chapter;
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
		let nextChapterValue = 0;
		for (const row of this.rows) {
			// Reset
			row.parent.classList.remove('current');
			row.node.style.backgroundColor = '';
			row.isNext = false;
			// Next Chapter is 0 if it exists and it's a new Title or the first next closest
			const isOpened = title.chapters.indexOf(row.progress.chapter) >= 0;
			if (
				!foundNext &&
				((row.progress.chapter > title.progress.chapter &&
					row.progress.chapter < Math.floor(title.progress.chapter) + 2) ||
					(row.progress.chapter == 0 && title.progress.chapter == 0 && title.status !== Status.COMPLETED))
			) {
				row.node.style.backgroundColor = Options.colors.nextChapter;
				row.isNext = true;
				foundNext = true;
				nextChapterValue = row.progress.chapter;
			} else if (foundNext && row.progress.chapter === nextChapterValue) {
				row.node.style.backgroundColor = Options.colors.nextChapter;
				row.isNext = true;
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
			if (row.progress.chapter == title.progress.chapter) {
				row.parent.classList.add('current');
			}
		}
	}
}

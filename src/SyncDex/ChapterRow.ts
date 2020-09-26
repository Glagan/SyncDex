import { DOM } from '../Core/DOM';
import { Options } from '../Core/Options';
import { SyncModule } from './SyncModule';

export class ChapterRow {
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
	hidden: boolean;
	language?: string;

	static previousRow?: ChapterRow;
	static languageMap: { [key: string]: string } = {};
	static rowLanguages: { code: string; node: HTMLElement }[] = [];

	constructor(chapterRow: HTMLElement) {
		const fullRow = chapterRow.parentElement!.parentElement!;
		if (ChapterRow.previousRow) {
			this.next = this.previous;
			ChapterRow.previousRow.previous = this;
		}
		ChapterRow.previousRow = this;
		this.isNext = false;
		this.node = fullRow;
		this.parent = chapterRow.querySelector(`a[href^='/chapter']`)!.parentElement!;
		const oneshot = chapterRow.dataset.title == 'Oneshot';
		this.progress = {
			chapter: oneshot ? 0 : parseFloat(chapterRow.dataset.chapter!),
			volume: parseFloat(chapterRow.dataset?.volume || '') || undefined,
			oneshot: oneshot,
		};
		this.hidden = false;

		// Update CSS
		if (!isNaN(this.progress.chapter)) {
			this.parent.classList.add('title-column');
			this.node.classList.add('has-transition');
			this.node.style.backgroundColor = '';
		}

		// Set as latest and chapter list buttons
		this.markButton = DOM.create('button', {
			class: 'btn btn-secondary btn-sm set-latest has-transition',
			childs: [DOM.icon('book'), DOM.space(), DOM.text('Set Latest')],
			title: 'Set as the Latest chapter',
		});
		this.manage = DOM.create('div', { childs: [this.markButton] });
		this.parent.appendChild(this.manage);
		if (Options.saveOpenedChapters) {
			this.toggleIcon = DOM.icon('plus');
			this.toggleButton = DOM.create('button', {
				class: 'btn btn-secondary btn-sm toggle-open has-transition',
				childs: [this.toggleIcon],
				title: 'Add to chapter list',
			});
			this.manage.appendChild(this.toggleButton);
		}

		if (Options.separateLanguages) {
			const flag = chapterRow.querySelector<HTMLImageElement>('.flag');
			if (flag) {
				const code = /flag-(\w+)/.exec(flag.className);
				if (code) {
					ChapterRow.rowLanguages.push({ code: code[1], node: this.node });
					ChapterRow.languageMap[code[1]] = flag.title;
					flag.title = `${flag.title} [${code[1]}]`;
					this.node.classList.add('hidden-lang', 'visible-lang');
				}
			}
		}
	}

	bind = (syncModule: SyncModule, rows: ChapterRow[]): void => {
		const title = syncModule.title;

		// Bind the +/- button for the Chapter list of the Title
		if (this.toggleButton) {
			this.toggleButton.addEventListener('click', async (event) => {
				event.preventDefault();
				if (this.toggleIcon!.classList.contains('fa-minus')) {
					title.removeChapter(this.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of rows) {
						if (otherRow.progress.chapter == this.progress.chapter) {
							if (!otherRow.isNext) otherRow.node.style.backgroundColor = '';
							otherRow.toggleButton!.title = 'Add to chapter list';
							otherRow.toggleIcon!.classList.remove('fa-minus');
							otherRow.toggleIcon!.classList.add('fa-plus');
						}
					}
				} else {
					title.addChapter(this.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of rows) {
						if (otherRow.progress.chapter == this.progress.chapter) {
							if (!otherRow.isNext) otherRow.node.style.backgroundColor = Options.colors.openedChapter;
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
		this.markButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (this.progress.chapter == title.progress.chapter) return;
			// Remove everything above current -- highligth and from opened
			let higherRow: ChapterRow = this;
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
			let currentRow: ChapterRow | undefined = this;
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
			this.parent.classList.add('current');
			if (this.next) {
				this.next.node.style.backgroundColor = Options.colors.nextChapter;
				this.next.isNext = true;
			}
			// Update Title
			title.progress.chapter = this.progress.chapter;
			if (title.status == Status.NONE) {
				title.status = Status.READING;
				title.start = new Date();
			}
			await title.persist();
			syncModule.overview.syncedLocal(title);
			await syncModule.syncExternal(true);
		});
	};

	static generateLanguageButtons = (
		parent: HTMLElement | null,
		appendFunction?: (parent: HTMLElement, tab: HTMLElement) => void
	): void => {
		const langLoaded = parent ? parent.classList.contains('lang-loaded') : true;
		if (Options.separateLanguages && parent && !langLoaded) {
			parent.classList.add('lang-loaded');

			// Find defaultLanguage
			const availableLanguages = Object.keys(ChapterRow.languageMap);
			const hasWantedLanguage = availableLanguages.includes(Options.favoriteLanguage);
			const defaultLanguage = hasWantedLanguage ? Options.favoriteLanguage : 'all';

			// Update style to fix tab height
			for (const tab of parent.children) {
				(tab as HTMLElement).style.display = 'flex';
			}

			// Add languages buttons
			let currentTab: HTMLElement | undefined = undefined;
			const hideAllExcept = (flag: string, tab: HTMLElement): void => {
				for (const row of ChapterRow.rowLanguages) {
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
				if (appendFunction) {
					appendFunction(parent, tab);
				} else parent.appendChild(tab);
				return tab;
			};

			const allTab = createTab(parent, 'all', 'All Languages', 'Display chapters in all Languages');
			if (defaultLanguage == 'all') hideAllExcept(defaultLanguage, allTab);
			for (const language of availableLanguages) {
				const tab = createTab(
					parent,
					language,
					ChapterRow.languageMap[language],
					`Show only chapters in ${ChapterRow.languageMap[language]}`
				);
				if (language == defaultLanguage) hideAllExcept(defaultLanguage, tab);
			}
		}
	};
}

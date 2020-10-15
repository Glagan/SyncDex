import { DOM } from '../Core/DOM';
import { Options } from '../Core/Options';

export class ChapterRow {
	isNext: boolean;
	node: HTMLElement;
	parent: HTMLElement;
	manage: HTMLElement;
	toggleButton?: HTMLButtonElement;
	toggleIcon?: HTMLElement;
	markButton: HTMLElement;
	progress: Progress;
	hidden: boolean;
	language?: string;

	static languageMap: { [key: string]: string } = {};
	static rowLanguages: { code: string; node: HTMLElement }[] = [];
	static currentTab?: HTMLElement;

	constructor(chapterRow: HTMLElement) {
		const fullRow = chapterRow.parentElement!.parentElement!;
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

	addManageButtons = (): void => {
		this.parent.appendChild(this.manage);
	};

	enableToggleButton = (): void => {
		this.toggleButton!.title = 'Remove from chapter list';
		this.toggleIcon!.classList.add('fa-minus');
		this.toggleIcon!.classList.remove('fa-plus');
	};

	disableToggleButton = (): void => {
		this.toggleButton!.title = 'Add to chapter list';
		this.toggleIcon!.classList.remove('fa-minus');
		this.toggleIcon!.classList.add('fa-plus');
	};

	static hideAllExcept = (flag: string, tab: HTMLElement, afterToggle?: () => void): void => {
		for (const row of ChapterRow.rowLanguages) {
			if (flag == 'all' || row.code == flag) {
				row.node.classList.add('visible-lang');
			} else {
				row.node.classList.remove('visible-lang');
			}
		}
		if (ChapterRow.currentTab) ChapterRow.currentTab.classList.remove('active');
		ChapterRow.currentTab = tab;
		ChapterRow.currentTab.classList.add('active');
		if (afterToggle) afterToggle();
	};

	static createLanguageTab = (
		parent: HTMLElement,
		flag: string,
		name: string,
		title: string,
		appendFunction?: (parent: HTMLElement, tab: HTMLElement) => void,
		afterToggle?: () => void
	): HTMLElement => {
		const tabLink = DOM.create('a', {
			class: `nav-link tab-${flag} ${flag == Options.favoriteLanguage ? 'active' : ''}`,
			href: '#',
			title: title,
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
		tabLink.addEventListener('click', (event) => {
			event.preventDefault();
			ChapterRow.hideAllExcept(flag, tab, afterToggle);
		});
		if (appendFunction) {
			appendFunction(parent, tab);
		} else parent.appendChild(tab);
		return tab;
	};

	static generateLanguageButtons = (
		parent: HTMLElement | null,
		appendFunction?: (parent: HTMLElement, tab: HTMLElement) => void,
		afterToggle?: () => void
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
			const allTab = ChapterRow.createLanguageTab(
				parent,
				'all',
				'All Languages',
				'Display chapters in all Languages',
				appendFunction,
				afterToggle
			);
			if (defaultLanguage == 'all') ChapterRow.hideAllExcept(defaultLanguage, allTab, afterToggle);
			for (const language of availableLanguages) {
				const tab = ChapterRow.createLanguageTab(
					parent,
					language,
					ChapterRow.languageMap[language],
					`Show only chapters in ${ChapterRow.languageMap[language]}`,
					appendFunction,
					afterToggle
				);
				if (language == defaultLanguage) ChapterRow.hideAllExcept(defaultLanguage, tab, afterToggle);
			}
		}
	};
}
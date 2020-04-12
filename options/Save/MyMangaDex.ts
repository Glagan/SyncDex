import { DOM } from '../../src/DOM';
import { Title, ExportedSave } from '../../src/interfaces';
import { LocalStorage } from '../../src/Storage';
import { ExtensionSave } from './ExtensionSave';
import { Options } from '../../src/Options';

interface MyMangaDexHistoryEntry {
	chapter: number;
	id: number;
	name: string;
	progress: {
		chapter: string;
		volume: string;
	};
	lastRead?: number;
}

interface MyMangaDexTitle {
	mal: number;
	last: number;
	chapters: number[];
	lastTitle?: number;
}

interface MyMangaDexColors {
	lastReadColor: string;
	lowerChaptersColor: string;
	lastOpenColors: string[];
	openedChaptersColor: string;
	nextChapterColor: string;
	higherChaptersColor: string;
}

interface MyMangaDexOptions extends MyMangaDexColors {
	hideLowerChapters: boolean;
	hideHigherChapters: boolean;
	hideLastRead: false;
	saveOnlyHigher: boolean;
	saveAllOpened: boolean;
	maxChapterSaved: number;
	updateMDList: boolean;
	showTooltips: boolean;
	highlightChapters: boolean;
	showNotifications: boolean;
	showErrors: boolean;
	saveOnlyNext: false;
	confirmChapter: boolean;
	updateHistoryPage: boolean;
	updateOnlyInList: false;
	historySize: number;
	showFullCover: false;
	coverMaxHeight: number;
}

interface MyMangaDexHistoryList {
	list: number[];
}

type MyMangaDexHistory = MyMangaDexHistoryList & {
	[key: string]: MyMangaDexHistoryEntry;
};

type MyMangaDexSave = {
	options?: MyMangaDexOptions;
} & {
	history?: MyMangaDexHistory;
} & {
	[key: string]: MyMangaDexTitle;
};

export class MyMangaDex extends ExtensionSave {
	name: string = 'MyMangaDex';
	key: string = 'mmd';
	form?: HTMLFormElement;

	import = (): void => {
		this.manager.clear();
		this.manager.header('Select your MyMangaDex save file');
		this.manager.node.appendChild(DOM.create('div', {
			class: 'block notification info',
			textContent: 'All of your MyMangaDex options will also be imported and MyAnimeList will be enabled if it\'s not already.'
		}));
		this.form = this.manager.form(
			[
				{
					type: 'checkbox',
					text: 'Override instead of merge',
					name: 'override',
				},
				{
					type: 'file',
					name: 'file',
				},
			],
			(event) => this.handle(event)
		);
	};

	export = undefined;

	handle = (event: Event): void => {
		event.preventDefault();
		this.removeError();
		if (!this.form) return;
		const merge = this.form.override.checked == false;
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result == 'string') {
				try {
					const titleList: string[] = [];
					let currentSave: ExportedSave | undefined = {} as ExportedSave;
					const newSave = {} as ExportedSave;
					let data = JSON.parse(reader.result) as MyMangaDexSave;
					// Options
					if (data.options) {
						this.loadOptions(data.options);
					}
					// Merge or override Titles
					Object.keys(data).forEach((value): void => {
						if (value !== 'options' && value !== 'history') {
							titleList.push(value);
							newSave[value] = this.convertTitle(data[value]);
						}
					});
					if (merge) {
						currentSave = await LocalStorage.getAll<Title>(titleList);
						this.mergeTitles(currentSave, newSave);
					}
					// History
					if (Options.biggerHistory && data.history) {
						this.loadHistory(newSave, data.history);
						if (merge) {
							this.mergeHistory(currentSave, newSave);
						}
					}
					// Save everything
					if (!merge) {
						await LocalStorage.clear();
					}
					await LocalStorage.raw(newSave);
					await Options.save();
					this.end();
				} catch (error) {
					this.displayError('Invalid file !');
				}
			} else {
				this.displayError('Unknown error, wrong file type.');
			}
		};
		if (this.form.file.files.length > 0) {
			reader.readAsText(this.form.file.files[0]);
		} else {
			this.displayError('No file !');
		}
	};

	end = (): void => {
		this.manager.clear();
		this.manager.header('Done Importing MyMangaDex');
		this.displaySuccess([
			DOM.text('Save successfully imported !'),
			DOM.space(),
			DOM.create('button', {
				class: 'action',
				textContent: 'Go Back',
				events: {
					click: () => this.manager.reset(),
				},
			}),
		]);
	};

	loadOptions = (old: MyMangaDexOptions): void => {
		Options.thumbnail = old.showTooltips;
		Options.originalThumbnail = old.showFullCover;
		Options.thumbnailMaxHeight = old.coverMaxHeight;
		Options.updateMD = old.updateMDList;
		Options.updateOnlyInList = old.updateOnlyInList;
		Options.notifications = old.showNotifications;
		Options.errorNotifications = old.showErrors;
		Options.hideHigher = old.hideHigherChapters;
		Options.hideLower = old.hideLowerChapters;
		Options.hideLast = old.hideLastRead;
		Options.saveOnlyHigher = old.saveOnlyHigher;
		Options.biggerHistory = old.updateHistoryPage;
		Options.historySize = old.historySize;
		Options.saveChapters = old.saveAllOpened;
		Options.chaptersSaved = old.maxChapterSaved;
		Options.highlight = old.highlightChapters;
		Options.saveOnlyNext = old.saveOnlyNext;
		Options.confirmChapter = old.confirmChapter;
		Options.colors = {
			highlights: old.lastOpenColors || Options.colors.highlights,
			nextChapter: old.nextChapterColor || Options.colors.nextChapter,
			higherChapter: old.higherChaptersColor || Options.colors.higherChapter,
			lowerChapter: old.lowerChaptersColor || Options.colors.lowerChapter,
			openedChapter: old.openedChaptersColor || Options.colors.openedChapter,
		};
	};

	loadHistory = (newSave: ExportedSave, old: MyMangaDexHistory): void => {
		newSave.history = [];
		Object.keys(old).forEach((value) => {
			if (newSave[value] !== undefined) {
				newSave[value].chapterId = old[value].chapter;
				newSave[value].name = old[value].name;
				newSave[value].lastRead = old[value].lastRead;
				newSave.history?.push(parseInt(value));
			}
		});
	};

	convertTitle = (old: MyMangaDexTitle): Title => {
		return {
			services: {
				mal: old.mal,
			},
			progress: {
				chapter: old.last,
			},
			lastTitle: old.lastTitle,
			chapters: old.chapters,
		} as Title;
	};
}

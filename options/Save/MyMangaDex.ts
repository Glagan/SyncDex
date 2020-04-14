import { DOM } from '../../src/DOM';
import { ExportedSave } from '../../src/interfaces';
import { LocalStorage } from '../../src/Storage';
import { ExtensionSave } from './ExtensionSave';
import { Options } from '../../src/Options';
import { Title, FullTitle } from '../../src/Title';

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
		this.manager.node.appendChild(
			DOM.create('div', {
				class: 'block notification info',
				textContent:
					"All of your MyMangaDex options will also be imported and MyAnimeList will be enabled if it's not already.",
			})
		);
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
					let newSave: ExportedSave = {};
					const titleList: string[] = [];
					let titles: Title[] = [];
					let data = JSON.parse(reader.result) as MyMangaDexSave;
					// Options
					if (data.options) {
						this.loadOptions(data.options);
					}
					// Merge or override Titles
					Object.keys(data).forEach((value): void => {
						if (value !== 'options' && value !== 'history') {
							titleList.push(value);
							titles.push(new Title(parseInt(value), this.convertTitle(data[value])));
						}
					});
					if (merge) {
						this.mergeTitles(await Title.getAll(titleList), titles);
					}
					// History
					if (Options.biggerHistory && data.history) {
						newSave.history = this.loadHistory(titles, data.history);
						if (merge) {
							newSave.history.concat(data.history.list);
						}
					}
					// Add each titles to the save
					for (let index = 0, len = titles.length; index < len; index++) {
						const title = titles[index];
						newSave[title.id] = title.toSave();
					}
					// Save
					if (!merge) {
						await LocalStorage.clear();
					}
					await LocalStorage.raw(newSave);
					await Options.save(); // TODO: Add MyAnimeList service
					// TODO: Reload everything
					this.end();
				} catch (error) {
					console.error(error);
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

	loadHistory = (titles: Title[], old: MyMangaDexHistory): number[] => {
		const history: number[] = [];
		for (const key in old) {
			const titleId = parseInt(key);
			const found = Title.findInCollection(titles, titleId);
			if (found >= 0) {
				let title = titles[found];
				title.lastChapter = old[key].chapter;
				title.name = old[key].name;
				title.lastRead = old[key].lastRead;
				history.push(titleId);
			}
		}
		return history;
	};

	convertTitle = (old: MyMangaDexTitle): FullTitle => {
		return {
			services: {
				mal: old.mal,
			},
			progress: {
				chapter: old.last,
			},
			lastTitle: old.lastTitle,
			chapters: old.chapters,
		};
	};
}

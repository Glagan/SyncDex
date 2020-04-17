import { LocalStorage } from '../../src/Storage';
import { ExtensionSave, ImportSummary } from './ExtensionSave';
import { Options } from '../../src/Options';
import { Title, FullTitle, TitleCollection } from '../../src/Title';
import { ServiceName, Status } from '../../src/Service/Service';
import { Checkbox, FileInput } from './Save';

interface MyMangaDexHistoryEntry {
	chapter: number;
	id: number;
	name: string;
	progress: {
		chapter: number;
		volume: number;
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
		this.notification(
			'info',
			"All of your MyMangaDex options will also be imported and MyAnimeList will be enabled if it's not already."
		);
		this.form = this.createForm(
			[
				new Checkbox('override', 'Erase current Save'),
				new FileInput('file', 'MyMangaDex save file', 'application/json'),
			],
			(event) => this.handle(event)
		);
	};

	export = undefined;

	handle = (event: Event): void => {
		event.preventDefault();
		this.removeNotifications();
		if (!this.form) return;
		const merge = this.form.override.checked == false;
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result == 'string') {
				try {
					let summary: ImportSummary = {
						options: 0,
						history: false,
						total: 0,
						invalid: 0,
					};
					let titles = new TitleCollection();
					let history: number[] | undefined = undefined;
					let data = JSON.parse(reader.result) as MyMangaDexSave;
					// Options
					if (data.options) {
						summary.options = this.loadOptions(data.options);
					}
					// Merge or override Titles
					Object.keys(data).forEach((value): void => {
						if (value !== 'options' && value !== 'history') {
							// Check if Title keys are valid and contain a valid Title
							if (
								!isNaN(parseInt(value)) &&
								this.isValidMyMangaDexTitle(data[value])
							) {
								titles.add(
									new Title(parseInt(value), this.convertTitle(data[value]))
								);
							} else {
								summary.invalid++;
							}
							summary.total++;
						}
					});
					if (merge) {
						titles.merge(await TitleCollection.get(titles.ids));
					}
					// History
					if (Options.biggerHistory && data.history) {
						history = this.loadHistory(titles, data.history);
						if (merge) {
							history.concat(data.history.list);
						}
						summary.history = false;
					}
					// Check if we did not import anything at all
					if (
						(summary.total == 0 || summary.total == summary.invalid) &&
						summary.options == 0 &&
						!summary.history
					) {
						throw 'Invalid file !';
					}
					// Save
					if (!merge) {
						await LocalStorage.clear();
					}
					await titles.save();
					if (history) {
						await LocalStorage.set('history', history);
					}
					// Add MyAnimeList and save options
					if (Options.services.indexOf(ServiceName.MyAnimeList) < 0) {
						Options.services.unshift(ServiceName.MyAnimeList);
						Options.mainService = ServiceName.MyAnimeList;
					}
					await Options.save();
					this.end(summary);
					this.manager.reload();
				} catch (error) {
					console.error(error);
					this.error('Invalid file !');
				}
			} else {
				this.error('Unknown error, wrong file type.');
			}
		};
		if (this.form.file.files.length > 0) {
			reader.readAsText(this.form.file.files[0]);
		} else {
			this.error('No file !');
		}
	};

	isValidMyMangaDexTitle = (title: Record<string, any>): boolean => {
		return (
			typeof title.mal === 'number' &&
			typeof title.last === 'number' &&
			Array.isArray(title.chapters) &&
			(title.lastTitle === undefined || typeof title.lastTitle === 'number')
		);
	};

	convertTitle = (old: MyMangaDexTitle): FullTitle => {
		return {
			services: {
				mal: old.mal,
			},
			status: Status.NONE,
			progress: {
				chapter: old.last,
			},
			lastTitle: old.lastTitle,
			chapters: old.chapters,
		};
	};

	loadOptions = (old: MyMangaDexOptions): number => {
		let total = 0;
		total += this.assignValidOption('thumbnail', old.showTooltips);
		total += this.assignValidOption('originalThumbnail', old.showFullCover);
		total += this.assignValidOption('thumbnailMaxHeight', old.coverMaxHeight);
		total += this.assignValidOption('updateMD', old.updateMDList);
		total += this.assignValidOption('updateOnlyInList', old.updateOnlyInList);
		total += this.assignValidOption('notifications', old.showNotifications);
		total += this.assignValidOption('errorNotifications', old.showErrors);
		total += this.assignValidOption('hideHigher', old.hideHigherChapters);
		total += this.assignValidOption('hideLower', old.hideLowerChapters);
		total += this.assignValidOption('hideLast', old.hideLastRead);
		total += this.assignValidOption('saveOnlyHigher', old.saveOnlyHigher);
		total += this.assignValidOption('biggerHistory', old.updateHistoryPage);
		total += this.assignValidOption('historySize', old.historySize);
		total += this.assignValidOption('saveChapters', old.saveAllOpened);
		total += this.assignValidOption('chaptersSaved', old.maxChapterSaved);
		total += this.assignValidOption('highlight', old.highlightChapters);
		total += this.assignValidOption('saveOnlyNext', old.saveOnlyNext);
		total += this.assignValidOption('confirmChapter', old.confirmChapter);
		Options.colors = {
			highlights: old.lastOpenColors || Options.colors.highlights,
			nextChapter: old.nextChapterColor || Options.colors.nextChapter,
			higherChapter: old.higherChaptersColor || Options.colors.higherChapter,
			lowerChapter: old.lowerChaptersColor || Options.colors.lowerChapter,
			openedChapter: old.openedChaptersColor || Options.colors.openedChapter,
		};
		return total;
	};

	isValidMyMangaDexHistory = (entry: MyMangaDexHistoryEntry): boolean => {
		return (
			typeof entry.chapter === 'number' &&
			typeof entry.name === 'string' &&
			typeof entry.progress == 'object' &&
			typeof entry.progress.chapter == 'number' &&
			(entry.progress.volume === undefined || typeof entry.progress.volume == 'number') &&
			(entry.lastRead === undefined || typeof entry.lastRead === 'number')
		);
	};

	loadHistory = (titles: TitleCollection, old: MyMangaDexHistory): number[] => {
		const history: number[] = [];
		for (const key in old) {
			const titleId = parseInt(key);
			const found = titles.find(titleId);
			if (found !== undefined && this.isValidMyMangaDexHistory(old[key])) {
				found.lastChapter = old[key].chapter;
				found.name = old[key].name;
				found.lastRead = old[key].lastRead;
				history.push(titleId);
			}
		}
		return history;
	};
}

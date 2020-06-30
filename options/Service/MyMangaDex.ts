import { Options } from '../../src/Options';
import { Title, TitleCollection } from '../../src/Title';
import { ImportSummary, Service, FileImportFormat, FileImportableModule } from './Service';
import { ServiceKey, Status, ServiceName } from '../../src/core';

interface MyMangaDexTitle {
	id: number;
	mal: number;
	last: number;
	chapters: number[];
	lastTitle?: number;
	lastMAL?: number;
	// History
	chapterId: number;
	lastRead: number;
	name: string;
	highest: number;
	progress: {
		chapter: number;
		volume?: number;
	};
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

type MyMangaDexSave = {
	options?: MyMangaDexOptions;
} & {
	history?: number[];
} & {
	[key: string]: MyMangaDexTitle;
};

// TODO: Handle save <2.4
class MyMangaDexImport extends FileImportableModule<MyMangaDexSave, MyMangaDexTitle> {
	fileType: FileImportFormat = 'JSON';

	convertTitles = async (titles: TitleCollection, titleList: MyMangaDexTitle[]): Promise<number> => {
		for (const title of titleList) {
			titles.add(
				new Title(title.id, {
					services: {
						mal: title.mal,
					},
					status: Status.NONE,
					progress: {
						chapter: title.last,
					},
					lastTitle: title.lastTitle,
					lastCheck: title.lastMAL,
					chapters: title.chapters,
					name: title.name,
					// History
					highest: title.highest,
					lastChapter: title.chapterId,
					history: title.progress,
				})
			);
		}
		return titleList.length;
	};

	isValidMyMangaDexTitle = (title: Record<string, any>): boolean => {
		return (
			typeof title.mal === 'number' &&
			typeof title.last === 'number' &&
			Array.isArray(title.chapters) &&
			(title.lastTitle === undefined || typeof title.lastTitle === 'number')
		);
	};

	handleTitles = async (save: MyMangaDexSave): Promise<MyMangaDexTitle[]> => {
		let titles: MyMangaDexTitle[] = [];
		for (const key in save) {
			if (key !== 'options' && key !== 'history') {
				// Check if Title keys are valid and contain a valid Title
				if (!isNaN(parseInt(key)) && this.isValidMyMangaDexTitle(save[key])) {
					titles.push({ ...save[key], id: parseInt(key) });
				}
			}
		}
		return titles;
	};

	handleOptions = (save: MyMangaDexSave, summary: ImportSummary): void => {
		const old = save.options;
		if (old !== undefined) {
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
			summary.options = total;
		}
		// Add MyAnimeList and save options
		if (Options.services.indexOf(ServiceName.MyAnimeList) < 0) {
			Options.services.unshift(ServiceName.MyAnimeList);
			Options.mainService = ServiceName.MyAnimeList;
		}
	};

	handleHistory = (save: MyMangaDexSave, titles: TitleCollection, summary: ImportSummary): number[] => {
		const history: number[] = [];
		if (!save.history || save.history.length == 0) return history;
		for (const titleId of save.history) {
			const found = titles.find(titleId);
			if (found !== undefined && !found.name && !found.lastChapter && !found.history) {
				history.push(titleId);
			}
		}
		summary.history = true;
		return history;
	};
}

export class MyMangaDex extends Service {
	key: ServiceKey = ServiceKey.MyMangaDex;
	name: ServiceName = ServiceName.MyMangaDex;

	activeModule = undefined;
	importModule: MyMangaDexImport = new MyMangaDexImport(this);
	exportModule = undefined;
}

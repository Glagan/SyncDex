import { DOM } from '../../Core/DOM';
import { log } from '../../Core/Log';
import { ModuleInterface } from '../../Core/ModuleInterface';
import { Options } from '../../Core/Options';
import { LocalStorage } from '../../Core/Storage';
import { LocalTitle, TitleCollection } from '../../Core/Title';
import { ServiceKey } from '../../Service/Keys';
import { ServiceName } from '../../Service/Names';
import { History } from '../../SyncDex/History';
import { SpecialService } from '../SpecialService';

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

export class MyMangaDex extends SpecialService {
	convertOptions = (data: MyMangaDexSave): void => {
		const old = data.options;
		if (old !== undefined) {
			this.assignValidOption('thumbnail', old.showTooltips);
			this.assignValidOption('originalThumbnail', old.showFullCover);
			this.assignValidOption('thumbnailMaxHeight', old.coverMaxHeight);
			this.assignValidOption('updateMD', old.updateMDList);
			this.assignValidOption('updateOnlyInList', old.updateOnlyInList);
			this.assignValidOption('notifications', old.showNotifications);
			this.assignValidOption('errorNotifications', old.showErrors);
			this.assignValidOption('hideHigher', old.hideHigherChapters);
			this.assignValidOption('hideLower', old.hideLowerChapters);
			this.assignValidOption('hideLast', old.hideLastRead);
			this.assignValidOption('saveOnlyHigher', old.saveOnlyHigher);
			this.assignValidOption('biggerHistory', old.updateHistoryPage);
			this.assignValidOption('saveOpenedChapters', old.saveAllOpened);
			this.assignValidOption('chaptersSaved', old.maxChapterSaved);
			this.assignValidOption('highlight', old.highlightChapters);
			this.assignValidOption('saveOnlyNext', old.saveOnlyNext);
			this.assignValidOption('confirmChapter', old.confirmChapter);
			Options.colors = {
				highlights: old.lastOpenColors || Options.colors.highlights,
				nextChapter: old.nextChapterColor || Options.colors.nextChapter,
				higherChapter: old.higherChaptersColor || Options.colors.higherChapter,
				lowerChapter: old.lowerChaptersColor || Options.colors.lowerChapter,
				openedChapter: old.openedChaptersColor || Options.colors.openedChapter,
			};
		}
		// Add MyAnimeList and save options
		if (Options.services.indexOf(ServiceKey.MyAnimeList) < 0) {
			Options.services.unshift(ServiceKey.MyAnimeList);
		}
	};

	isValidMyMangaDexTitle = (title: Record<string, any>): boolean => {
		return (
			typeof title.mal === 'number' &&
			!isNaN(title.mal) &&
			title.mal > 0 &&
			typeof title.last === 'number' &&
			Array.isArray(title.chapters) &&
			(title.lastTitle === undefined || typeof title.lastTitle === 'number')
		);
	};

	handleFile = async (data: MyMangaDexSave, moduleInterface: ModuleInterface): Promise<any> => {
		// Find all Titles
		let message = moduleInterface.message('loading', 'Loading MyMangaDex Titles...');
		const titles: MyMangaDexTitle[] = [];
		for (const key in data) {
			if (key !== 'options' && key !== 'history') {
				// Check if LocalTitle keys are valid and contain a valid LocalTitle
				const id = parseInt(key);
				if (!isNaN(id) && this.isValidMyMangaDexTitle(data[key])) {
					titles.push({ ...data[key], id: id });
				}
			}
		}
		message.classList.remove('loading');
		if (moduleInterface.doStop) return moduleInterface.complete();
		if (titles.length == 0) {
			moduleInterface.message('warning', 'No Titles found !');
			return moduleInterface.complete();
		}

		// Convert all Titles
		const collection = new TitleCollection();
		let progress = DOM.create('p');
		message = moduleInterface.message('loading', [progress]);
		let max = titles.length;
		for (let i = 0; !moduleInterface.doStop && i < max; i++) {
			const title = titles[i];
			progress.textContent = `Converting title ${i + 1} out of ${max} (${title.name ?? 'No Name'}).`;
			const localTitle: Partial<LocalTitle> = {
				services: {},
				status: Status.NONE,
				progress: {
					chapter: title.last,
				},
				max: {
					chapter: title.highest ? title.highest : undefined,
				},
				lastTitle: title.lastTitle,
				chapters: title.chapters,
				name: title.name,
				// History
				highest: title.highest,
				lastChapter: title.chapterId,
				history: title.progress,
			};
			if (title.mal) localTitle.services!.mal = { id: title.mal };
			collection.add(new LocalTitle(title.id, localTitle));
		}
		message.classList.remove('loading');
		if (moduleInterface.doStop) return moduleInterface.complete();

		// Handle options and history
		message = moduleInterface.message('loading', 'Converting Options');
		this.convertOptions(data);
		const history: number[] = [];
		if (data.history && data.history.length > 0) {
			for (const id of data.history) {
				const found = collection.find(id);
				if (found !== undefined && found.name && found.lastChapter && found.history) {
					history.unshift(id);
				}
			}
		}
		message.classList.remove('loading');
		if (moduleInterface.doStop) return moduleInterface.complete();

		// Mochi
		if (this.options.mochi.active) {
			await this.mochi(collection, moduleInterface, { names: true });
			if (moduleInterface.doStop) return moduleInterface.complete();
		}

		// Save
		message = moduleInterface.message('loading', 'Saving...');
		if (!this.options.merge.active) {
			await LocalStorage.clear();
			if (history) await LocalStorage.set('history', { ids: history });
		} else if (collection.length > 0) {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		if (history && this.options.merge.active) {
			await History.load();
			History.ids = [...new Set(History.ids.concat(history))];
			await History.save();
		}
		await Options.save();

		// Save
		await collection.persist();
		moduleInterface.message;
		message.classList.remove('loading');
		moduleInterface.message('success', `Imported ${collection.length} Titles, History and Options !`);
		this.reload();
		moduleInterface.complete();
	};

	start = async (): Promise<void> => {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.createOptions(this.options);
		moduleInterface.setStyle(DOM.text(ServiceName.MyMangaDex), ServiceName.MyMangaDex);

		// Add File input
		const inputId = `file_${ServiceKey.MyMangaDex}`;
		DOM.append(
			moduleInterface.form,
			DOM.message(
				'warning',
				'It is not recommended to import from MyMangaDex, since your score, start/end dates, status, and the name of each Title will be missing.\nA better option is to make sure your MyAnimeList is up to date and import from MyAnimeList.'
			),
			DOM.create('h2', {
				childs: [DOM.create('label', { class: '', textContent: 'Save File', htmlFor: inputId })],
			}),
			DOM.create('div', {
				class: 'row-parameter',
				childs: [
					DOM.create('input', {
						name: 'save',
						id: inputId,
						type: 'file',
						required: true,
						accept: 'application/json',
					}),
				],
			})
		);

		// Show the Modal
		const form = moduleInterface.form;
		moduleInterface.bindFormSubmit(() => {
			// Check if there is a file and set options
			if (!form.save || form.save.files.length < 1) {
				moduleInterface.message('warning', 'No file !');
				return moduleInterface.complete();
			}
			moduleInterface.setOptionsValues(this.options);

			// Read File
			let message = moduleInterface.message('loading', 'Loading file...');
			var reader = new FileReader();
			reader.onload = async (): Promise<any> => {
				if (typeof reader.result !== 'string') {
					if (message) message.classList.remove('loading');
					message = moduleInterface.message('warning', 'Unknown error, wrong file type.');
					return moduleInterface.complete();
				}
				let data: MyMangaDexSave;
				try {
					data = JSON.parse(reader.result) as MyMangaDexSave;
					if (message) message.classList.remove('loading');
					this.handleFile(data, moduleInterface);
				} catch (error) {
					await log(error);
					if (message) message.classList.remove('loading');
					message = moduleInterface.message('warning', 'Invalid file !');
					moduleInterface.complete();
				}
			};
			reader.readAsText(form.save.files[0]);
		});
		moduleInterface.modal.show();
	};
}

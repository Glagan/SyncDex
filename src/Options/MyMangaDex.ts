import { DOM } from '../Core/DOM';
import { ModuleInterface } from '../Core/ModuleInterface';
import { AvailableOptions, Options } from '../Core/Options';
import { ActivableKey, StaticKey, StaticName } from '../Core/Service';
import { LocalStorage } from '../Core/Storage';
import { LocalTitle, TitleCollection } from '../Core/Title';
import { OptionsManager } from './OptionsManager';
import { SpecialService } from './SpecialService';

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
	assignValidOption = <K extends keyof AvailableOptions>(key: K, value: AvailableOptions[K]): number => {
		// Check if the value is the same type as the value in the Options
		if (typeof value === typeof Options[key]) {
			// Check if the key actually exist
			if ((Options as AvailableOptions)[key] !== undefined || key === 'mainService') {
				(Options as AvailableOptions)[key] = value;
				return 1;
			}
		}
		return 0;
	};

	convertOptions = (data: MyMangaDexSave): void => {
		const old = data.options;
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
			total += this.assignValidOption('saveOpenedChapters', old.saveAllOpened);
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
		}
		// Add MyAnimeList and save options
		if (Options.services.indexOf(ActivableKey.MyAnimeList) < 0) {
			Options.services.unshift(ActivableKey.MyAnimeList);
			Options.mainService = ActivableKey.MyAnimeList;
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

	handleFile = async (data: MyMangaDexSave, moduleInterface: ModuleInterface): Promise<void> => {
		// Find all Titles
		let message = moduleInterface.message('loading', 'Loading MyMangaDex Titles...');
		const titles: MyMangaDexTitle[] = [];
		for (const key in data) {
			if (key !== 'options' && key !== 'history') {
				// Check if LocalTitle keys are valid and contain a valid LocalTitle
				if (!isNaN(parseInt(key)) && this.isValidMyMangaDexTitle(data[key])) {
					titles.push({ ...data[key], id: parseInt(key) });
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

		// Save
		message = moduleInterface.message('loading', 'Saving...');
		if (!this.options.merge.active) {
			await LocalStorage.clear();
			await Options.save();
		} else if (collection.length > 0) {
			collection.merge(await TitleCollection.get(collection.ids));
		}

		// TODO: Mochi

		// Save
		await collection.persist();
		moduleInterface.message;
		message.classList.remove('loading');
		moduleInterface.message('success', `Imported ${collection.length} Titles, History and Options !`);
		OptionsManager.instance.reload();
		moduleInterface.complete();
	};

	start = async (): Promise<void> => {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.createOptions(this.options);
		moduleInterface.setStyle(DOM.text(StaticName.MyMangaDex), StaticKey.MyMangaDex);

		// Add File input
		const inputId = `file_${StaticKey.MyMangaDex}`;
		DOM.append(
			moduleInterface.form,
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
			reader.onload = async (): Promise<void> => {
				if (typeof reader.result !== 'string') {
					if (message) message.classList.remove('loading');
					message = moduleInterface.message('warning', 'Unknown error, wrong file type.');
					return moduleInterface.complete();
				}
				let data: MyMangaDexSave;
				try {
					data = JSON.parse(reader.result) as MyMangaDexSave;
				} catch (error) {
					console.error(error);
					if (message) message.classList.remove('loading');
					message = moduleInterface.message('warning', 'Invalid file !');
					return moduleInterface.complete();
				}
				if (message) message.classList.remove('loading');
				this.handleFile(data, moduleInterface);
			};
			reader.readAsText(form.save.files[0]);
		});
		moduleInterface.modal.show();
	};
}

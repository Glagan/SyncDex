import { LocalStorage } from './Storage';

console.log('SyncDex :: Options');

const version = parseFloat(chrome.runtime.getManifest().version);
class Options {
	// Chapter and Title List / Updates
	hideHigher: boolean = false;
	hideLower: boolean = true;
	hideLast: boolean = false;
	highlight: boolean = true;
	thumbnail: boolean = true;
	originalThumbnail: boolean = false;
	thumbnailMaxHeight: number = 80;
	updateServicesInList: boolean = false;
	// Reading
	saveChapters: boolean = true;
	chaptersSaved: number = 400;
	saveOnlyHigher: boolean = true;
	saveOnlyNext: boolean = false;
	confirmChapter: boolean = false;
	updateOnlyInList: boolean = false;
	// Title
	linkToServices: boolean = true;
	showOverview: boolean = true;
	overviewMainOnly: boolean = true;
	// History
	biggerHistory: boolean = false;
	historySize: number = 100;
	// Notifications
	notifications: boolean = true;
	errors: boolean = true;
	// Global
	useFetch: boolean = true;
	useNikurasu: boolean = true;
	acceptLowScore: boolean = true;
	updateMD: boolean = false;
	// Services
	services: Service[] = [];
	mainService: Service | undefined = undefined;
	noReloadStatus: boolean = true;
	tokens: {
		anilistToken: string | undefined;
		kitsuUser: string | undefined;
		kitsuToken: string | undefined;
	} = {
		anilistToken: undefined,
		kitsuUser: undefined,
		kitsuToken: undefined
	};
	// Colors
	colors: {
		highlights: string[];
		nextChapter: string;
		higherChapter: string;
		lowerChapter: string;
		openedChapter: string; // Title Page
	} = {
		highlights: ['rgba(28, 135, 141, 0.5)', 'rgba(22, 65, 87, 0.5)', 'rgba(28, 103, 141, 0.5)'],
		nextChapter: 'rgba(199, 146, 2, 0.4)',
		higherChapter: 'transparent',
		lowerChapter: 'rgba(180, 102, 75, 0.5)',
		openedChapter: 'rgba(28, 135, 141, 0.4)' // Title Page
	};
	version: number = version;
}

interface Update {
	version: number;
	fnct: (options: Options) => void;
}

const updates: Update[] = [];

export class UserOptions extends Options {
	async load(): Promise<void> {
		const options = await LocalStorage.get<Options>('options');
		if (options !== undefined) {
			Object.assign(this, options);
		}
		if (this.checkUpdate()) {
			this.update();
			await LocalStorage.set('options', this);
		}
		return new Promise<void>(() => {});
	}

	checkUpdate = (): boolean => {
		if (this.version !== version) {
			return true;
		}
		return false;
	};

	update = (): void => {
		for (let index = 0; index < updates.length; index++) {
			const update = updates[index];
			if (update.version >= this.version) {
				update.fnct(this);
				this.version = update.version;
			}
		}
		this.version = version;
	};
}

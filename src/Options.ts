import { LocalStorage } from './Storage';
import { browser } from './Browser';

console.log('SyncDex :: Options');

enum Service {
	'MyAnimeList',
	'MangaUpdates',
	'Anilist',
	'Kitsu',
	'AnimePlanet'
}

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
	chaptersSaved: number = 100;
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
	// Global
	notifications: boolean = true;
	errors: boolean = true;
	useFetch: boolean = true;
	useNikurasu: boolean = true;
	acceptLowScore: boolean = true;
	updateMD: boolean = false;
	progressBar: boolean = true;
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
		higherChapter: string;
		lowerChapter: string;
		currentChapter: string;
		openedChapter: string; // Title Page
	} = {
		highlights: [
			'rgba(28, 135, 141, 0.5)',
			'rgba(22, 65, 87, 0.5)',
			'rgba(28, 103, 141, 0.5)'
		],
		higherChapter: 'rgba(75, 180, 60, 0.8)',
		lowerChapter: 'rgba(180, 102, 75, 0.5)',
		currentChapter: 'rgba(75, 180, 60, 0.6)',
		openedChapter: 'rgba(28, 135, 141, 0.4)' // Title Page
	};
	version: number = browser.runtime.getManifest().version;

	async load(): Promise<void> {
		const options = await LocalStorage.get<Options>('options');
		Object.assign(this, options);
		return new Promise<void>(() => {});
	}
}

export { Options };

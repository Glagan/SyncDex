import { LocalStorage } from './Storage';
import { browser } from 'webextension-polyfill-ts';

console.log('SyncDex :: Options');

export const DefaultOptions: AvailableOptions = {
	// Chapter and Title List / Updates
	hideHigher: false,
	hideLower: true,
	hideLast: false,
	highlight: true,
	groupTitlesInLists: true,
	thumbnail: true,
	originalThumbnail: false,
	progressInThumbnail: true,
	thumbnailMaxHeight: 80,
	separateLanguages: true,
	favoriteLanguage: 'all',
	// Reading
	saveOpenedChapters: true,
	chaptersSaved: 400,
	saveOnlyHigher: true,
	saveOnlyNext: false,
	confirmChapter: true,
	updateOnlyInList: false,
	// Title
	linkToServices: true,
	overviewMainOnly: true,
	autoSync: true,
	mdUpdateSyncDex: false,
	// History
	biggerHistory: true,
	chapterStatus: false,
	// Notifications
	notifications: true,
	errorNotifications: true,
	// Global
	useMochi: true,
	acceptLowScore: false,
	updateMD: true,
	checkOnStartup: false,
	checkOnStartupMainOnly: true,
	checkOnStartupCooldown: 30,
	// Services
	services: [],
	mainService: null,
	noReloadStatus: true,
	tokens: {
		anilistToken: undefined,
		kitsuUser: undefined,
		kitsuToken: undefined,
	},
	// Colors
	colors: {
		highlights: ['rgba(82, 190, 90, 0.6)', 'rgba(107, 177, 95, 0.6)', 'rgba(55, 168, 61, 0.6)'],
		nextChapter: 'rgba(104, 115, 251, 0.4)',
		higherChapter: 'transparent',
		lowerChapter: 'rgba(180, 102, 75, 0.5)',
		openedChapter: 'rgba(28, 135, 141, 0.4)', // Title Page
	},
	version: parseFloat(browser.runtime.getManifest().version),
	subVersion: parseInt(/\.(\d+)$/.exec(browser.runtime.getManifest().version)![1]),
};

interface ManageOptions {
	load: () => Promise<void>;
	reloadTokens: () => Promise<void>;
	save: () => Promise<void>;
	reset: () => void;
}

export const Options: AvailableOptions & ManageOptions = Object.assign(
	JSON.parse(JSON.stringify(DefaultOptions)), // Avoid references
	{
		load: async (): Promise<void> => {
			const options = await LocalStorage.get('options');
			if (options !== undefined) {
				Object.assign(Options, options);
			} else return Options.save();
		},

		reloadTokens: async (): Promise<void> => {
			const options = await LocalStorage.get('options');
			if (options !== undefined && options.tokens !== undefined) {
				Options.tokens = {};
				Object.assign(Options.tokens, options.tokens);
			}
		},

		save: (): Promise<void> => {
			const values = Object.assign({}, Options) as AvailableOptions & Partial<ManageOptions>;
			delete values.load;
			delete values.reloadTokens;
			delete values.save;
			delete values.reset;
			return LocalStorage.set('options', values);
		},

		reset: (): void => {
			Object.assign(Options, JSON.parse(JSON.stringify(DefaultOptions)));
		},
	}
);

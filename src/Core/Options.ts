import { LocalStorage } from './Storage';
import { ActivableKey } from './Service';
import { browser } from 'webextension-polyfill-ts';

console.log('SyncDex :: Options');

export interface AvailableOptions {
	// Chapter and Title List / Updates
	hideHigher: boolean;
	hideLower: boolean;
	hideLast: boolean;
	highlight: boolean;
	groupTitlesInLists: boolean;
	thumbnail: boolean;
	originalThumbnail: boolean;
	progressInThumbnail: boolean;
	thumbnailMaxHeight: number;
	separateLanguages: boolean;
	favoriteLanguage: string;
	// Reading
	saveOpenedChapters: boolean;
	chaptersSaved: number;
	saveOnlyHigher: boolean;
	saveOnlyNext: boolean;
	confirmChapter: boolean;
	updateOnlyInList: boolean;
	// Title
	linkToServices: boolean;
	overviewMainOnly: boolean;
	autoSync: boolean;
	mdUpdateSyncDex: boolean;
	// History
	biggerHistory: boolean;
	chapterStatus: boolean;
	// Notifications
	notifications: boolean;
	errorNotifications: boolean;
	// Global
	useMochi: boolean;
	acceptLowScore: boolean;
	updateMD: boolean;
	checkOnStartup: boolean;
	// Services
	services: ActivableKey[];
	mainService: ActivableKey | undefined;
	noReloadStatus: boolean;
	tokens: Partial<{
		anilistToken: string | undefined;
		kitsuUser: string | undefined;
		kitsuToken: string | undefined;
	}>;
	// Colors
	colors: {
		highlights: string[];
		nextChapter: string;
		higherChapter: string;
		lowerChapter: string;
		openedChapter: string; // Title Page
	};
	version: number;
}

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
	updateMD: false,
	checkOnStartup: false,
	// Services
	services: [],
	mainService: undefined,
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
			const options = await LocalStorage.get<AvailableOptions>('options');
			if (options !== undefined) {
				Object.assign(Options, options);
			} else {
				return await Options.save();
			}
		},

		reloadTokens: async (): Promise<void> => {
			const options = await LocalStorage.get<AvailableOptions>('options');
			if (options !== undefined && options.tokens !== undefined) {
				Options.tokens = {};
				Object.assign(Options.tokens, options.tokens);
			}
		},

		save: async (): Promise<void> => {
			const values = Object.assign({}, Options) as AvailableOptions & Partial<ManageOptions>;
			delete values.load;
			delete values.reloadTokens;
			delete values.save;
			delete values.reset;
			return await LocalStorage.set('options', values);
		},

		reset: (): void => {
			Object.assign(Options, JSON.parse(JSON.stringify(DefaultOptions)));
		},
	}
);

import { LocalStorage } from './Storage';
import { ServiceName } from './Title';

console.log('SyncDex :: Options');

export interface AvailableOptions {
	// Chapter and Title List / Updates
	hideHigher: boolean;
	hideLower: boolean;
	hideLast: boolean;
	highlight: boolean;
	thumbnail: boolean;
	originalThumbnail: boolean;
	thumbnailMaxHeight: number;
	updateServicesInList: boolean;
	// Reading
	saveChapters: boolean;
	chaptersSaved: number;
	saveOnlyHigher: boolean;
	saveOnlyNext: boolean;
	confirmChapter: boolean;
	updateOnlyInList: boolean;
	// Title
	linkToServices: boolean;
	showOverview: boolean;
	overviewMainOnly: boolean;
	// History
	biggerHistory: boolean;
	chapterStatus: boolean;
	// Notifications
	notifications: boolean;
	errorNotifications: boolean;
	// Global
	useXHR: boolean;
	useMochi: boolean;
	acceptLowScore: boolean;
	updateMD: boolean;
	// Services
	services: ServiceName[];
	mainService: ServiceName | undefined;
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
	thumbnail: true,
	originalThumbnail: false,
	thumbnailMaxHeight: 80,
	updateServicesInList: false,
	// Reading
	saveChapters: true,
	chaptersSaved: 400,
	saveOnlyHigher: true,
	saveOnlyNext: false,
	confirmChapter: false,
	updateOnlyInList: false,
	// Title
	linkToServices: true,
	showOverview: true,
	overviewMainOnly: true,
	// History
	biggerHistory: true,
	chapterStatus: false,
	// Notifications
	notifications: true,
	errorNotifications: true,
	// Global
	useXHR: false,
	useMochi: true,
	acceptLowScore: false,
	updateMD: false,
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
		highlights: ['rgba(28, 135, 141, 0.5)', 'rgba(22, 65, 87, 0.5)', 'rgba(28, 103, 141, 0.5)'],
		nextChapter: 'rgba(199, 146, 2, 0.4)',
		higherChapter: 'transparent',
		lowerChapter: 'rgba(180, 102, 75, 0.5)',
		openedChapter: 'rgba(28, 135, 141, 0.4)', // Title Page
	},
	version: parseFloat(browser.runtime.getManifest().version),
};
// export type AvailableOptions = {
// 	[K in Exclude<keyof typeof DefaultOptions, 'prototype'>]: typeof DefaultOptions[K];
// };

interface Update {
	version: number;
	fnct: (options: AvailableOptions) => void;
}
const updates: Update[] = [];

interface ManageOptions {
	load: () => Promise<void>;
	reloadTokens: () => Promise<void>;
	checkUpdate: () => boolean;
	update: () => void;
	save: () => Promise<void>;
	reset: () => void;
}

export const Options: AvailableOptions & ManageOptions = Object.assign(
	{
		load: async (): Promise<void> => {
			const options = await LocalStorage.get<AvailableOptions>('options');
			if (options !== undefined) {
				Object.assign(Options, options);
			}
			const needUpdate = Options.checkUpdate();
			if (needUpdate) {
				Options.update();
			}
			if (!options || needUpdate) {
				return Options.save();
			}
			return new Promise<void>((resolve) => resolve());
		},

		reloadTokens: async (): Promise<void> => {
			const options = await LocalStorage.get<AvailableOptions>('options');
			if (options !== undefined && options.tokens !== undefined) {
				Options.tokens = {};
				Object.assign(Options.tokens, options.tokens);
			}
		},

		checkUpdate: (): boolean => {
			if (Options.version !== DefaultOptions.version) {
				return true;
			}
			return false;
		},

		update: (): void => {
			for (const update of updates) {
				if (update.version >= Options.version) {
					update.fnct(Options);
					Options.version = update.version;
				}
			}
			Options.version = DefaultOptions.version;
		},

		save: async (): Promise<void> => {
			const values = Object.assign({}, Options);
			delete values.load;
			delete values.reloadTokens;
			delete values.checkUpdate;
			delete values.update;
			delete values.save;
			delete values.reset;
			return await LocalStorage.set('options', values);
		},

		reset: (): void => {
			Object.assign(Options, JSON.parse(JSON.stringify(DefaultOptions)));
		},
	},
	JSON.parse(JSON.stringify(DefaultOptions)) // Avoid references
);

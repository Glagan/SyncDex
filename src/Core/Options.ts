import { Storage } from './Storage';
import { browser } from 'webextension-polyfill-ts';
import { dispatch } from './Event';

console.log('SyncDex :: Options');

export enum LogLevel {
	Default = 0,
	ExecutionTime = 1,
	Debug = 2,
}

export const DefaultOptions: Readonly<AvailableOptions> = {
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
	iconsSilentAfterSync: false,
	saveOnLastPage: false,
	// Title
	linkToServices: true,
	overviewMainOnly: true,
	mdUpdateSyncDex: false,
	// History
	biggerHistory: true,
	chapterStatus: false,
	// Notifications
	notifications: true,
	displaySyncStart: false,
	displayProgressUpdated: true,
	errorNotifications: true,
	errorDuration: 4000,
	infoDuration: 4000,
	successDuration: 4000,
	// Global
	useMochi: true,
	acceptLowScore: false,
	updateMD: true,
	updateMDProgress: false,
	checkOnStartup: false,
	checkOnStartupMainOnly: true,
	checkOnStartupCooldown: 30,
	silentUpdate: false,
	logLevel: LogLevel.Default,
	// Services
	services: [],
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

export const Options: Options = Object.assign(
	JSON.parse(JSON.stringify(DefaultOptions)), // Avoid references
	{
		async load() {
			const options = await Storage.get('options');
			if (options !== undefined) {
				Object.assign(Options, options);
			} else return Options.save();
		},

		async reloadTokens() {
			const options = await Storage.get(StorageUniqueKey.Options);
			if (options !== undefined && options.tokens !== undefined) {
				Options.tokens = {};
				Object.assign(Options.tokens, options.tokens);
			}
		},

		async save() {
			const values = Object.assign({}, Options) as AvailableOptions & Partial<ManageOptions>;
			// Delete functions, we can't pass them and they are not deleted
			delete values.load;
			delete values.reloadTokens;
			delete values.save;
			delete values.reset;
			dispatch('options:saving');
			await Storage.set(StorageUniqueKey.Options, values);
			dispatch('options:saved');
		},

		reset() {
			Object.assign(Options, JSON.parse(JSON.stringify(DefaultOptions)));
		},
	}
);

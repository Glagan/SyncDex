import { LocalStorage } from './Storage';
import { ServiceName } from './Service/Service';

console.log('SyncDex :: Options');

/*export interface DefaultOptions {
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
	historySize: number;
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
	tokens: {
		anilistToken: string | undefined;
		kitsuUser: string | undefined;
		kitsuToken: string | undefined;
	};
	// Colors
	colors: {
		highlights: string[];
		nextChapter: string;
		higherChapter: string;
		lowerChapter: string;
		openedChapter: string; // Title Page
	};
	version: number;
}*/

export class DefaultOptions {
	// Chapter and Title List / Updates
	static hideHigher: boolean = false;
	static hideLower: boolean = true;
	static hideLast: boolean = false;
	static highlight: boolean = true;
	static thumbnail: boolean = true;
	static originalThumbnail: boolean = false;
	static thumbnailMaxHeight: number = 80;
	static updateServicesInList: boolean = false;
	// Reading
	static saveChapters: boolean = true;
	static chaptersSaved: number = 400;
	static saveOnlyHigher: boolean = true;
	static saveOnlyNext: boolean = false;
	static confirmChapter: boolean = false;
	static updateOnlyInList: boolean = false;
	// Title
	static linkToServices: boolean = true;
	static showOverview: boolean = true;
	static overviewMainOnly: boolean = true;
	// History
	static biggerHistory: boolean = false;
	static historySize: number = 100;
	static chapterStatus: boolean = false;
	// Notifications
	static notifications: boolean = true;
	static errorNotifications: boolean = true;
	// Global
	static useXHR: boolean = true;
	static useMochi: boolean = true;
	static acceptLowScore: boolean = true;
	static updateMD: boolean = false;
	// Services
	static services: ServiceName[] = [];
	static mainService?: ServiceName = undefined;
	static noReloadStatus: boolean = true;
	static tokens: {
		anilistToken?: string;
		kitsuUser?: number;
		kitsuToken?: string;
	} = {
		anilistToken: undefined,
		kitsuUser: undefined,
		kitsuToken: undefined,
	};
	// Colors
	static colors = {
		highlights: ['rgba(28, 135, 141, 0.5)', 'rgba(22, 65, 87, 0.5)', 'rgba(28, 103, 141, 0.5)'],
		nextChapter: 'rgba(199, 146, 2, 0.4)',
		higherChapter: 'transparent',
		lowerChapter: 'rgba(180, 102, 75, 0.5)',
		openedChapter: 'rgba(28, 135, 141, 0.4)', // Title Page
	};
	static version: number = parseFloat(browser.runtime.getManifest().version);
};
export type AvailableOptions = { [K in Exclude<keyof typeof DefaultOptions, 'prototype'>]: typeof DefaultOptions[K] };

interface Update {
	version: number;
	fnct: (options: DefaultOptions) => void;
}
const updates: Update[] = [];

// export const Options: ManageOptions = Object.assign({} as ManageOptions, DefaultOptions, {
export class Options extends DefaultOptions {
	static load = async (): Promise<void> => {
		const options = await LocalStorage.get<DefaultOptions>('options');
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
	}

	static get = <K extends keyof AvailableOptions>(key: K): AvailableOptions[K] => {
		return (Options as AvailableOptions)[key];
	}

	static set = <K extends keyof AvailableOptions>(key: K, value?: AvailableOptions[K]): Options => {
		if (value !== undefined) {
			(Options as AvailableOptions)[key] = value;
		}
		return Options;
	}

	static checkUpdate = (): boolean => {
		if (Options.version !== DefaultOptions.version) {
			return true;
		}
		return false;
	}

	static update = (): void => {
		for (let index = 0; index < updates.length; index++) {
			const update = updates[index];
			if (update.version >= Options.version) {
				update.fnct(Options);
				Options.version = update.version;
			}
		}
		Options.version = DefaultOptions.version;
	}

	static save = async (): Promise<void> => {
		const values = Object.assign({}, Options);
		delete values.load;
		delete values.get;
		delete values.set;
		delete values.checkUpdate;
		delete values.update;
		delete values.save;
		return await LocalStorage.set('options', values);
	}
};
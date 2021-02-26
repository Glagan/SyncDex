interface Window {
	// I only use the *on* fuction of the Reader...
	reader?: {
		model: {
			on: (event: ReaderEvent, callback: (data: any) => void) => void;
		};
		view: any;
	};
}

/**
 * Messages
 */

interface FormDataFile {
	content: string[];
	name: string;
	options?: FilePropertyBag | undefined;
}

interface FormDataProxy {
	[key: string]: string | number | FormDataFile;
}

declare const enum RequestStatus {
	SUCCESS,
	CREATED,
	DELETED,
	MISSING_TOKEN,
	FAIL,
	SERVER_ERROR,
	BAD_REQUEST,
	NOT_FOUND,
}

declare const enum MessageAction {
	request = 'request',
	openOptions = 'openOptions',
	silentImport = 'silentImport',
	importStart = 'importStart',
	importComplete = 'importComplete',
	saveSync = 'saveSync',
	saveSyncStart = 'saveSyncStart',
	saveSyncComplete = 'saveSyncComplete',
	saveSyncLogout = 'saveSyncLogout',
}

interface RequestMessage {
	action: MessageAction.request;
	method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'DELETE' | 'PUT' | 'PATCH';
	url: string;
	isJson?: boolean;
	body?: string | null;
	form?: FormDataProxy | FormData;
	cache?: RequestCache;
	mode?: RequestMode;
	headers?: HeadersInit;
	redirect?: RequestRedirect;
	credentials?: RequestCredentials;
	fileRequest?: 'localSave' | 'namedLocalSave';
}

interface FetchJSONMessage extends RequestMessage {
	isJson: true;
}

interface OpenOptionsMessage {
	action: MessageAction.openOptions;
}

interface ImportMessage {
	action: MessageAction.silentImport | MessageAction.importStart | MessageAction.importComplete;
}

declare const enum SaveSyncLoginResult {
	SUCCESS,
	STATE_ERROR,
	API_ERROR,
	ERROR,
}

declare const enum SaveSyncResult {
	UPLOADED,
	DOWNLOADED,
	SYNCED,
	NOTHING,
	ERROR,
}

type SaveSyncMessage =
	| {
			action: MessageAction.saveSync;
			delay?: number;
	  }
	| {
			action: MessageAction.saveSyncStart | MessageAction.saveSyncLogout;
	  }
	| {
			action: MessageAction.saveSyncComplete;
			status?: SaveSyncResult;
	  };

type MessagePayload = RequestMessage | OpenOptionsMessage | ImportMessage | SaveSyncMessage;

interface RequestResponse<T extends {} = Record<string, any> | string> {
	url: string;
	redirected: boolean;
	ok: boolean;
	failed: boolean;
	code: number;
	headers: Record<string, string>;
	body: T;
}

interface JSONResponse<T extends {} = Record<string, any>> extends RequestResponse<T> {}

interface RawResponse extends RequestResponse<string> {}

/**
 * Storage
 */

declare const enum Status {
	NONE,
	READING,
	COMPLETED,
	PAUSED,
	PLAN_TO_READ,
	DROPPED,
	REREADING,
	WONT_READ,
}

interface Progress {
	chapter: number;
	volume?: number;
	oneshot?: boolean;
}

//type ServiceID = { id: number } | { slug: string };
type MediaKey = { id: number; slug?: string } | { id?: number; slug: string } | { id: number; slug: string };
type ServiceList = { [key in import('./Service/Keys').ActivableKey]?: MediaKey };

interface AvailableOptions {
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
	iconsSilentAfterSync: boolean;
	saveOnLastPage: boolean;
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
	errorDuration: number;
	infoDuration: number;
	successDuration: number;
	// Global
	useMochi: boolean;
	acceptLowScore: boolean;
	updateMD: boolean;
	updateMDProgress: boolean;
	checkOnStartup: boolean;
	checkOnStartupMainOnly: boolean;
	checkOnStartupCooldown: number;
	silentUpdate: boolean;
	logLevel: import('./Core/Options').LogLevel;
	// Services
	services: import('./Service/Keys').ActivableKey[];
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
	subVersion: number;
}

interface ManageOptions {
	load: () => Promise<void>;
	reloadTokens: () => Promise<void>;
	save: () => Promise<void>;
	reset: () => void;
}

type Options = AvailableOptions & ManageOptions;

interface PKCEWaitingState {
	state: string;
	verifier: string;
}

interface SaveSyncState {
	service: string;
	token: string;
	expires: number;
	refresh: string;
	id?: string;
}

interface HistoryObject {
	last?: number;
	page?: number;
	ids: number[];
}
interface LogLine {
	d: number;
	msg: string;
}

type SaveMediaKey = { s?: string; i?: number } | number;
type SaveServiceList = {
	[key in import('./Service/Keys').ActivableKey]?: SaveMediaKey;
};

interface SaveProgress {
	c: number;
	v?: number;
	o?: 1;
}

interface StorageTitle {
	s: SaveServiceList; // services
	fs?: import('./Service/Keys').ActivableKey[]; // forced services
	st: Status; // status
	sc?: number; // score
	p: SaveProgress; // progress
	m?: Partial<SaveProgress>; // maxProgress
	v?: { [key: number]: number | [number, number] }; // volumeChapterCount
	c?: number[]; // chapters
	sd?: number; // start
	ed?: number; // end
	lt?: number; // lastTitle
	n?: string; // name
	// History
	id?: number; // lastChapter
	h?: SaveProgress; // history
	hi?: number; // highest
	lr?: number; // lastRead
}

declare const enum StorageUniqueKey {
	Options = 'options',
	Import = 'import',
	ImportInProgress = 'importInProgress',
	Logs = 'logs',
	History = 'history',
	GoogleDriveState = 'googleDriveState',
	DropboxState = 'dropboxState',
	SaveSync = 'saveSync',
	SaveSyncInProgress = 'saveSyncInProgress',
	LastSync = 'lastSync',
}

type ExportedSave = {
	[key: string]: StorageTitle;
} & Partial<{
	[StorageUniqueKey.Options]: AvailableOptions;
	[StorageUniqueKey.Import]: number | string[];
	[StorageUniqueKey.ImportInProgress]: boolean;
	[StorageUniqueKey.Logs]: LogLine[];
	[StorageUniqueKey.History]: HistoryObject;
	[StorageUniqueKey.GoogleDriveState]: string;
	[StorageUniqueKey.DropboxState]: PKCEWaitingState;
	[StorageUniqueKey.SaveSync]: SaveSyncState;
	[StorageUniqueKey.SaveSyncInProgress]: boolean;
	[StorageUniqueKey.LastSync]: number;
}>;

/**
 * MangaDex
 */

interface MangaDexChapter {
	id: number;
	hash: string;
	mangaId: number;
	chapter: string;
	comments: number;
	groupIds: number[];
	groupWebsite: string | null;
	language: string;
	pages: string[] | string;
	read: boolean;
	server: string | undefined;
	serverFallback: string | undefined;
	status: MangaDexStatus;
	threadId: number | null;
	timestamp: number;
	title: string;
	volume: string;
}

type MangaDexExternalKey =
	| 'al' // Anilist
	| 'amz' // Amazon
	| 'ap' // AnimePlanet
	| 'bw' // BookWalker
	| 'ebj' // eBookJapan
	| 'kt' // Kitsu
	| 'mal' // MyAnimeList
	| 'mu' // MangaUpdates
	| 'nu' // NovelUpdates
	| 'raw' // Raw source
	| 'engtl'; // Official English release

interface MangaDexSimpleManga {
	id: number;
	isHentai: boolean;
	language: string;
	lastChapter: string | null;
	lastVolume: string | null;
	links: { [key in MangaDexExternalKey]?: string };
	mainCover: string;
	tags: number[];
	title: string;
}

/**
 * Events
 */

type Title = import('./Core/Title').Title;
type EventPayloads = {
	// Title
	'title:synced': { fields: (keyof Title)[]; title: Title };
	// MangaDex
	'mangadex:syncing': { field: 'status' | 'rating' | 'progress' };
	'mangadex:synced': {
		field: 'status' | 'rating' | 'progress';
		value: { status: Status; progress: Progress; score: number };
	};
	// Sync Module
	'sync:initialize:start': never;
	'sync:initialize:end': never;
	// Services
	'service:syncing': { service: import('./Service/Keys').ServiceKey };
	'service:synced': {
		service: import('./Service/Keys').ServiceKey;
		title: Title;
		local: import('./Core/Title').LocalTitle;
	};
	// Save Sync
	'savesync:start': { service: import('./Core/SaveSync').SaveSync };
	'savesync:end': { service: import('./Core/SaveSync').SaveSync };
	// Options
	'options:saving': never;
	'options:saved': never;
	'options:updated': { name: keyof AvailableOptions; options: Options };
	// SyncDex
	'syncdex:reloaded': never;
	'syncdex:loaded': { page: import('./SyncDex/Page').Page };
};

type EventCallback<K extends keyof EventPayloads> = (payload?: EventPayloads[K]) => void;
type EventDispatchParams<K extends keyof EventPayloads> = EventPayloads[K] extends never
	? [event: K]
	: [event: K, payload: EventPayloads[K]];

interface EventOptions {
	// Block the following events of the same type until callback is completed
	blocking?: boolean;
	// Send the event trough a Runtime message to be received in the background script/in the options or in a tab
	global?: boolean;
}

interface EventDescription<K extends keyof EventPayloads> {
	callback: EventCallback<K>;
	options?: EventOptions;
}

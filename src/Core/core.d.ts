interface Window {
	// I only use the *on* fuction of the Reader...
	reader?: {
		model: {
			on: (event: ReaderEvent, callback: (data: any) => void) => void;
		};
		view: any;
	};
}

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

//type ServiceID = { id: number } | { slug: string };
type MediaKey = { id: number; slug?: string } | { id?: number; slug: string } | { id: number; slug: string };

interface Progress {
	chapter: number;
	volume?: number;
	oneshot?: boolean;
}

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
}

interface RequestMessage {
	action: MessageAction.request;
	method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'DELETE' | 'PUT' | 'PATCH';
	url: string;
	isJson?: boolean;
	body?: FormDataProxy | FormData | string | null;
	cache?: RequestCache;
	mode?: RequestMode;
	headers?: HeadersInit;
	redirect?: RequestRedirect;
	credentials?: RequestCredentials;
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

type Message = RequestMessage | OpenOptionsMessage | ImportMessage;

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

type ExportOptions = {
	options?: AvailableOptions;
};

type ImportState = {
	import?: number | string[];
	importInProgress?: true;
};

type HistoryObject = {
	last?: number;
	page?: number;
	ids: number[];
};

type ExportHistory = {
	history?: HistoryObject;
};

type ExportedTitles = {
	[key: string]: StorageTitle;
};

type ExportedSave = ExportOptions & ExportHistory & ExportedTitles & ImportState;

declare const enum ListType {
	Detailed,
	Expanded,
	Simple,
	Grid,
}

type ReaderEvent =
	| 'loadingchange'
	| 'renderingmodechange'
	| 'displayfitchange'
	| 'directionchange'
	| 'chapterchange'
	| 'mangachange'
	| 'statechange'
	| 'currentpagechange'
	| 'readererror'
	| 'pageload'
	| 'pageerror'
	| 'settingchange';

interface MangaDexChapter {
	chapter: '1';
	comments: number;
	group_id: number;
	group_name: string;
	// + group_id_x & group_name_x
	id: number;
	lang_code: string;
	lang_name: string;
	timestamp: number;
	title: string;
	volume: string;
}

type MangaDexExternalKeys =
	| 'al' // Anilist
	| 'amz' // Amazon
	| 'ap' // AnimePlanet
	| 'bw' // BookWalker
	| 'ebj' // eBookJapan
	| 'kt' // Kitsu
	| 'mal' // MyAnimeList
	| 'mu' // MangaUpdates
	| 'nu' // NovelUpdates
	| 'raw'; // Raw Link

interface ChapterChangeEventDetails {
	_data: {
		chapter: string;
		comments: number;
		group_id: number;
		group_name: string;
		// + group_id_x & group_name_x
		hash: string;
		id: number;
		lang_code: string;
		lang_name: string;
		long_strip: number;
		manga_id: number;
		page_array: string[];
		server: string;
		server_fallback: string;
		status: string;
		timestamp: number;
		title: string;
		volume: string;
	};
	_isNetworkServer: boolean;
	manga: {
		_data: {
			alt_names: string[];
			artist: string;
			author: string;
			cover_url: string;
			description: string;
			genres: number[];
			hentai: number;
			id: number;
			lang_flag: string;
			lang_name: string;
			last_chapter: string;
			last_volume: number;
			last_updated: number;
			links: { [key in MangaDexExternalKeys]: string };
			rating: {
				bayesian: string;
				mean: string;
				users: string;
			};
			status: number;
			demographic: number;
			title: string;
			views: number;
			follows: number;
			comments: number;
			covers: string[];
		};
		chapterList: MangaDexChapter[]; // Available for selected languages
		chapters: MangaDexChapter[]; // Everything available
		response: Response;
	};
	response: Response;
}

interface ChapterChangeEvent extends Event {
	detail: ChapterChangeEventDetails;
}

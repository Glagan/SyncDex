interface Window {
	chrome: typeof chrome;
	browser?: typeof browser;
	// I only use the on fuction on the Reader...
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

interface AnimePlanetReference {
	s: string;
	i: number;
}

interface Progress {
	chapter: number;
	volume?: number;
}

interface FormDataFile {
	content: string[];
	name: string;
	options?: FilePropertyBag | undefined;
}

interface FormDataProxy {
	[key: string]: string | number | FormDataFile;
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

type Message = RequestMessage | OpenOptionsMessage;

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

declare const chrome: {
	runtime: {
		getManifest: () => {
			version: string;
		};
		openOptionsPage: (resolve?: () => void) => Promise<void>;
		sendMessage: <T extends RequestResponse | void>(
			message: Message,
			resolve?: (response?: T) => void
		) => Promise<any>;
		onMessage: {
			addListener: (
				fnct: (message: Message, _sender: any, sendResponse: (response?: RequestResponse | void) => void) => any
			) => void;
		};
		getURL: (path: string) => string;
	};
	storage: {
		local: {
			get: <T>(key: string[] | string | null, resolve?: () => void) => Promise<Record<string, T> | undefined>;
			set: (data: Object, resolve?: () => void) => Promise<void>;
			remove: (key: string, resolve?: () => void) => Promise<void>;
			clear: (resolve?: () => void) => Promise<void>;
		};
	};
	browserAction: {
		onClicked: {
			addListener: (callback: () => void) => void;
		};
	};
};

declare const browser: {
	runtime: {
		getManifest: typeof chrome.runtime.getManifest;
		openOptionsPage: () => Promise<void>;
		sendMessage: <T extends RequestResponse | void>(message: Message) => Promise<T>;
		onMessage: {
			addListener: (fnct: (message: Message) => Promise<RequestResponse | void>) => void;
		};
		getURL: (path: string) => string;
	};
	storage: {
		local: {
			get: <T>(key: string[] | string | null) => Promise<Record<string, any> | Record<string, T> | undefined>;
			set: (data: Object) => Promise<any>;
			remove: (key: string) => Promise<any>;
			clear: () => Promise<any>;
		};
	};
	browserAction: {
		onClicked: {
			addListener: (callback: () => void) => void;
		};
	};
};

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
			links: { [key in MangaDexExternalKeys]: string };
			rating: {
				bayesian: string;
				mean: string;
				users: string;
			};
			status: number;
			title: string;
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

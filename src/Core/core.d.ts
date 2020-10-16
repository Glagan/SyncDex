interface Window {
	chrome: typeof chrome;
	browser?: typeof browser;
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

interface AnimePlanetReference {
	s: string;
	i: number;
}

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

interface MessageSender {
	tab?: {
		active: boolean;
		attention?: boolean;
		audible?: boolean;
		autoDiscardable?: boolean;
		cookieStoreId?: string;
		discarded?: boolean;
		favIconUrl?: string;
		height?: number;
		hidden: boolean;
		highlighted: boolean;
		id?: number;
		incognito: boolean;
		index: number;
		isArticle: boolean;
		isInReaderMode: boolean;
		lastAccessed: number;
		mutedInfo?: any;
		openerTabId?: number;
		pinned: boolean;
		selected: boolean;
		sessionId?: string;
		status?: string;
		successorTabId?: number;
		title?: string;
		url?: string;
		width?: number;
		windowId: number;
	};
	frameId?: number;
	id?: string;
	url?: string;
	tlsChannelId?: string;
}

interface Cookie {
	domain: string;
	expirationDate?: number;
	firstPartyDomain: string;
	hostOnly: boolean;
	httpOnly: boolean;
	name: string;
	path: string;
	secure: boolean;
	session: boolean;
	sameSite: boolean;
	storeId: string;
	value: string;
}

interface CookiesAPI {
	get: (details: {}) => Cookie;
	getAll: (details: {
		domain?: string;
		firstPartyDomain?: string;
		name?: string;
		path?: string;
		secure?: boolean;
		session?: boolean;
		storeId?: string;
		url?: string;
	}) => Promise<Cookie[]>;
	set: (details: {}) => Promise<Cookie>;
	remove: (details: {}) => Promise<Cookie>;
	getAllCookieStores: () => Promise<
		{
			id: string;
			incognito: boolean;
			tabIds: number[];
		}[]
	>;
}

interface HttpHeader {
	name: string;
	value?: string;
	binaryValue?: number[];
}

type ResourceType =
	| 'beacon'
	| 'csp_report'
	| 'font'
	| 'image'
	| 'imageset'
	| 'main_frame'
	| 'media'
	| 'object'
	| 'object_subrequest'
	| 'ping'
	| 'script'
	| 'speculative'
	| 'stylesheet'
	| 'sub_frame'
	| 'web_manifest'
	| 'websocket'
	| 'xbl'
	| 'xml_dtd'
	| 'xmlhttprequest'
	| 'xslt'
	| 'other';

interface WebRequestDetails {
	cookieStoreId: string;
	documentUrl: string;
	frameId: number;
	incognito: boolean;
	method: string;
	originUrl: string;
	parentFrameId: number;
	proxyInfo: {};
	requestHeaders: HttpHeader[];
	requestId: string;
	tabId: number;
	thirdParty: boolean;
	timeStamp: number;
	type: ResourceType;
	url: string;
	urlClassification: {};
}

interface BlockingResponse {
	authCredentials?: {};
	cancel?: boolean;
	redirectUrl?: string;
	requestHeaders?: HttpHeader[];
	responseHeaders?: HttpHeader[];
	upgradeToSecure?: boolean;
}

interface onInstallDetails {
	id?: number;
	previousVersion?: string;
	reason: 'install' | 'update' | 'browser_update' | 'shared_module_update';
	temporary: boolean;
}

type onInstallListener = (details: onInstallDetails) => void;

interface WebRequestAPI {
	onBeforeRequest: {};
	onBeforeSendHeaders: {
		addListener: (
			callback: (details: WebRequestDetails) => BlockingResponse | void,
			filter: {
				urls: string[];
				types?: ResourceType[];
				tabId?: number;
				windowId?: number;
				incognito?: boolean;
			},
			extraInfoSpec?: ('blocking' | 'requestHeaders')[]
		) => void;
		removeListener: () => void;
		hasListener: () => void;
	};
	onSendHeaders: {};
	onHeadersReceived: {};
	onAuthRequired: {};
	onResponseStarted: {};
	onBeforeRedirect: {};
	onCompleted: {};
	onErrorOccurred: {};
}

interface Tab {
	active?: boolean;
	cookieStoreId?: string;
	discarded?: boolean;
	index?: number;
	openerTabId?: number;
	openInReaderMode?: boolean;
	pinned?: boolean;
	selected?: boolean;
	title?: string;
	url?: string;
	windowId?: number;
}

declare const chrome: {
	runtime: {
		getManifest: () => {
			version: string;
		};
		openOptionsPage: (resolve?: () => void) => void;
		sendMessage: <T extends RequestResponse | void>(message: Message, resolve?: (response?: T) => void) => void;
		onMessage: {
			addListener: (
				callback: (
					message: Message,
					sender: MessageSender,
					sendResponse: (response?: RequestResponse | void) => void
				) => any
			) => void;
		};
		getURL: (path: string) => string;
		onInstalled: {
			addListener: (callback: onInstallListener) => void;
		};
	};
	storage: {
		local: {
			get: <T>(key: string[] | string | null, callback?: (value: Record<string, T> | undefined) => void) => void;
			set: (data: Object, callback?: () => void) => void;
			remove: (key: string, callback?: () => void) => void;
			clear: (callback?: () => void) => void;
		};
	};
	browserAction: {
		onClicked: {
			addListener: (callback: () => void) => void;
		};
	};
	cookies: CookiesAPI;
	webRequest: WebRequestAPI;
	tabs: {
		create: (details: Tab, callback?: (tab: Tab) => void) => void;
	};
};

declare const browser: {
	runtime: {
		getManifest: typeof chrome.runtime.getManifest;
		openOptionsPage: () => Promise<void>;
		sendMessage: <T extends RequestResponse | void>(message: Message) => Promise<T>;
		onMessage: {
			addListener: (fnct: (message: Message, sender: MessageSender) => Promise<RequestResponse | void>) => void;
		};
		getURL: (path: string) => string;
		onInstalled: {
			addListener: (callback: onInstallListener) => void;
		};
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
	cookies: CookiesAPI;
	webRequest: WebRequestAPI;
	tabs: {
		create: (properties: Tab) => Promise<Tab>;
	};
};

type ExportOptions = {
	options?: AvailableOptions;
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

type ExportedSave = ExportOptions & ExportHistory & ExportedTitles;

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

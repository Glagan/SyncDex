interface Window {
	chrome: typeof chrome;
	browser?: typeof browser;
}

const enum Status {
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

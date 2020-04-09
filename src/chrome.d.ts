interface Window {
	chrome: typeof chrome;
	browser?: typeof browser;
}

declare const chrome: {
	runtime: {
		getManifest: () => {
			version: string;
		};
		openOptionsPage: (resolve?: () => void) => Promise<any>;
		onMessage: {
			addListener: (
				fnct: (message: any, _sender: any, sendResponse: () => void) => Promise<any>
			) => any;
		};
	};
	storage: {
		local: {
			get: (key: string | null, resolve?: () => void) => Promise<Object | undefined>;
			set: (data: Object, resolve?: () => void) => Promise<any>;
			remove: (key: string, resolve?: () => void) => Promise<any>;
			clear: (resolve?: () => void) => Promise<any>;
		};
	};
};

declare const browser: {
	runtime: {
		getManifest: typeof chrome.runtime.getManifest;
		openOptionsPage: () => Promise<any>;
		onMessage: typeof chrome.runtime.onMessage;
	};
	storage: {
		local: {
			get: <T>(key: string[] | string | null) => Promise<{ [key: string]: T } | undefined>;
			set: (data: Object) => Promise<any>;
			remove: (key: string) => Promise<any>;
			clear: () => Promise<any>;
		};
	};
};

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
		sendMessage: (
			message: FetchMessage | OpenOptionsMessage,
			resolve?: (response?: any) => void
		) => Promise<any>;
		onMessage: {
			addListener: (
				fnct: (
					message: FetchMessage | OpenOptionsMessage,
					_sender: any,
					sendResponse: (response?: any) => void
				) => any
			) => void;
		};
	};
	storage: {
		local: {
			get: <T>(
				key: string[] | string,
				resolve?: () => void
			) => Promise<Record<string, T> | undefined>;
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
		sendMessage: (message: FetchMessage | OpenOptionsMessage) => Promise<any>;
		onMessage: {
			addListener: (
				fnct: (message: FetchMessage | OpenOptionsMessage) => Promise<any>
			) => void;
		};
	};
	storage: {
		local: {
			get: <T>(key: string[] | string) => Promise<Record<string, T> | undefined>;
			set: (data: Object) => Promise<any>;
			remove: (key: string) => Promise<any>;
			clear: () => Promise<any>;
		};
	};
};

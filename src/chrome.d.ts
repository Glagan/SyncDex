declare const chrome: {
	runtime: {
		getManifest: () => {
			version: string;
		};
		openOptionsPage: () => Promise<any>;
		onMessage: {
			addListener: (
				fnct: (
					message: any,
					_sender: any,
					sendResponse: () => void
				) => Promise<any>
			) => any;
		};
	};
	storage: {
		local: {
			get: (
				key: string | null,
				resolve?: () => void
			) => Promise<Object | undefined>;
			set: (data: Object, resolve?: () => void) => Promise<any>;
			remove: (key: string, resolve?: () => void) => Promise<any>;
			clear: (resolve?: () => void) => Promise<any>;
		};
	};
};

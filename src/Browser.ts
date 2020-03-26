console.log('SyncDex :: Browser');

export const browser = (() => {
	return (
		(<any>window).msBrowser || (<any>window).browser || (<any>window).chrome
	);
})();
export const isChrome =
	(<any>window).chrome && (<any>window).browser === undefined;

console.log('SyncDex :: Browser');

export const isChrome =
	(<any>window).chrome && (<any>window).browser === undefined;

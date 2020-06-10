export enum ServiceName {
	MyAnimeList = 'MyAnimeList',
	MangaUpdates = 'MangaUpdates',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	AnimePlanet = 'AnimePlanet',
	MangaDex = 'MangaDex',
	MyMangaDex = 'MyMangaDex',
	SyncDex = 'SyncDex',
}

export enum ServiceKey {
	MyAnimeList = 'mal',
	MangaUpdates = 'mu',
	Anilist = 'al',
	Kitsu = 'ku',
	AnimePlanet = 'ap',
	MangaDex = 'md',
	MyMangaDex = 'mmd',
	SyncDex = 'sc',
}

export const enum Status {
	NONE,
	READING,
	COMPLETED,
	PAUSED,
	DROPPED,
	PLAN_TO_READ,
	REREADING,
	WONT_READ,
}

export const enum LoginStatus {
	MISSING_TOKEN,
	SUCCESS,
	FAIL,
	SERVER_ERROR,
	BAD_REQUEST,
}

export abstract class Service {
	abstract key: ServiceKey;
	abstract name: ServiceName;
	abstract loggedIn(): Promise<LoginStatus>;
	abstract toStatus(status: any): Status;
	abstract fromStatus(status: Status): any;
}

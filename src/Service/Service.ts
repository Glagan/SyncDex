export enum ServiceName {
	MyAnimeList = 'MyAnimeList',
	MangaUpdates = 'MangaUpdates',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	AnimePlanet = 'AnimePlanet',
}

export enum ServiceKey {
	MyAnimeList = 'mal',
	MangaUpdates = 'mu',
	Anilist = 'al',
	Kitsu = 'ku',
	AnimePlanet = 'ap',
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
	NO_AUTHENTIFICATION,
	SUCCESS,
	FAIL,
	SERVER_ERROR,
	BAD_REQUEST,
}

export abstract class Service {
	abstract name: ServiceName;
	abstract loggedIn: () => Promise<LoginStatus>;
	static status: { [key in Status]: number | string };
}

import { RequestStatus } from '../Runtime';

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

export interface ServiceKeyMap {
	[ServiceKey.MyAnimeList]: number;
	[ServiceKey.MangaUpdates]: number;
	[ServiceKey.Anilist]: number;
	[ServiceKey.Kitsu]: number;
	[ServiceKey.AnimePlanet]: number;
	[ServiceKey.MangaDex]: number;
	[ServiceKey.MyMangaDex]: number;
	[ServiceKey.SyncDex]: number;
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

export abstract class Service<T = any> {
	abstract key: ServiceKey;
	abstract name: ServiceName;
	abstract loggedIn(): Promise<RequestStatus>;
	abstract toStatus(status: T): Status;
	abstract fromStatus(status: Status): T;
}

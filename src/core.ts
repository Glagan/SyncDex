import { AvailableOptions } from './Options';
import { SaveTitle } from './Title';

export interface Progress {
	chapter: number;
	volume?: number;
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

export type ExportOptions = {
	options?: AvailableOptions;
};

export type ExportHistory = {
	history?: number[];
};

export type ExportedTitles = {
	[key: string]: SaveTitle;
};

export type ExportedSave = ExportOptions & ExportHistory & ExportedTitles;

/** Generated File */
export enum StaticKey {
	'SyncDex' = 'sc',
	'MyMangaDex' = 'mmd',
	'MangaDex' = 'md',
}

export enum ActivableKey {
	'MyAnimeList' = 'mal',
	'Anilist' = 'al',
	'Kitsu' = 'ku',
	'AnimePlanet' = 'ap',
	'MangaUpdates' = 'mu',
}

export const ServiceKey = {
	...StaticKey,
	...ActivableKey,
};
export type OverviewKey = ActivableKey | StaticKey.SyncDex;
export type ServiceKey = StaticKey | ActivableKey;

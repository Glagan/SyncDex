/** Generated File */
import { Service } from '../Core/Service';
import { ActivableKey } from './Keys';
import { MyAnimeList } from './MyAnimeList';
import { Anilist } from './Anilist';
import { Kitsu } from './Kitsu';
import { AnimePlanet } from './AnimePlanet';
import { MangaUpdates } from './MangaUpdates';

export const Services: { [key in ActivableKey]: Service } = {
	[ActivableKey.MyAnimeList]: new MyAnimeList(),
	[ActivableKey.Anilist]: new Anilist(),
	[ActivableKey.Kitsu]: new Kitsu(),
	[ActivableKey.AnimePlanet]: new AnimePlanet(),
	[ActivableKey.MangaUpdates]: new MangaUpdates(),
};

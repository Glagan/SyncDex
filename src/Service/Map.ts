/** Generated File */
import { Service } from '../Core/Service';
import { ActivableKey } from './Keys';
import { MyAnimeList } from './MyAnimeList';
import { Anilist } from './Anilist';
import { Kitsu } from './Kitsu';
import { AnimePlanet } from './AnimePlanet';
import { MangaUpdates } from './MangaUpdates';

export const Services: { [key in ActivableKey]: typeof Service } = {
	[ActivableKey.MyAnimeList]: MyAnimeList,
	[ActivableKey.Anilist]: Anilist,
	[ActivableKey.Kitsu]: Kitsu,
	[ActivableKey.AnimePlanet]: AnimePlanet,
	[ActivableKey.MangaUpdates]: MangaUpdates,
};

import { Anilist } from '../Service/Anilist';
import { AnimePlanet } from '../Service/AnimePlanet';
import { Kitsu } from '../Service/Kitsu';
import { MangaUpdates } from '../Service/MangaUpdates';
import { MyAnimeList } from '../Service/MyAnimeList';
import { ActivableKey, Service } from './Service';

export const Services: { [key in ActivableKey]: typeof Service } = {
	[ActivableKey.MyAnimeList]: MyAnimeList,
	[ActivableKey.MangaUpdates]: MangaUpdates,
	[ActivableKey.Anilist]: Anilist,
	[ActivableKey.Kitsu]: Kitsu,
	[ActivableKey.AnimePlanet]: AnimePlanet,
};

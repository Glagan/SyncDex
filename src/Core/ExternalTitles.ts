import { ActivableKey } from './Service';
import { ExternalTitle } from './Title';
import { AnilistTitle } from '../Service/Anilist';
import { AnimePlanetTitle } from '../Service/AnimePlanet';
import { KitsuTitle } from '../Service/Kitsu';
import { MangaUpdatesTitle } from '../Service/MangaUpdates';
import { MyAnimeListTitle } from '../Service/MyAnimeList';

export const ExternalTitles: { [key in ActivableKey]: typeof ExternalTitle } = {
	[ActivableKey.MyAnimeList]: MyAnimeListTitle,
	[ActivableKey.MangaUpdates]: MangaUpdatesTitle,
	[ActivableKey.Anilist]: AnilistTitle,
	[ActivableKey.Kitsu]: KitsuTitle,
	[ActivableKey.AnimePlanet]: AnimePlanetTitle,
};

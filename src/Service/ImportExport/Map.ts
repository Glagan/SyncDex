/** Generated File */
import { ActivableKey } from '../Keys';
import { ImportModule, ExportModule } from '../../Core/Module';
import { MyAnimeListImport, MyAnimeListExport } from './MyAnimeList';
import { AnilistImport, AnilistExport } from './Anilist';
import { KitsuImport, KitsuExport } from './Kitsu';
import { AnimePlanetImport, AnimePlanetExport } from './AnimePlanet';
import { MangaUpdatesImport, MangaUpdatesExport } from './MangaUpdates';

export const ServicesImport: { [key in ActivableKey]?: typeof ImportModule } = {
	[ActivableKey.MyAnimeList]: MyAnimeListImport,
	[ActivableKey.Anilist]: AnilistImport,
	[ActivableKey.Kitsu]: KitsuImport,
	[ActivableKey.AnimePlanet]: AnimePlanetImport,
	[ActivableKey.MangaUpdates]: MangaUpdatesImport,
};

export const ServicesExport: { [key in ActivableKey]?: typeof ExportModule } = {
	[ActivableKey.MyAnimeList]: MyAnimeListExport,
	[ActivableKey.Anilist]: AnilistExport,
	[ActivableKey.Kitsu]: KitsuExport,
	[ActivableKey.AnimePlanet]: AnimePlanetExport,
	[ActivableKey.MangaUpdates]: MangaUpdatesExport,
};

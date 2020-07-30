import { ActivableName } from './Title';
import { MyAnimeListTitle } from './Service/MyAnimeList';
import { AnilistTitle } from './Service/Anilist';
import { KitsuTitle } from './Service/Kitsu';
import { AnimePlanetTitle } from './Service/AnimePlanet';
import { MangaUpdatesTitle } from './Service/MangaUpdates';

export function GetService(service: ActivableName) {
	switch (service) {
		case ActivableName.MyAnimeList:
			return MyAnimeListTitle;
		case ActivableName.Anilist:
			return AnilistTitle;
		case ActivableName.Kitsu:
			return KitsuTitle;
		case ActivableName.AnimePlanet:
			return AnimePlanetTitle;
		case ActivableName.MangaUpdates:
			return MangaUpdatesTitle;
	}
}

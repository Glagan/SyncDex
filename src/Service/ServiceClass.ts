import { MyAnimeList } from './MyAnimeList';
import { AnimePlanet } from './AnimePlanet';
import { Kitsu } from './Kitsu';
import { Anilist } from './Anilist';
import { MangaUpdates } from './MangaUpdates';
import { ServiceName, Service } from './Service';
import { Options } from '../Options';

export function ServiceClass(name: ServiceName): Service {
	if (name == 'MyAnimeList') {
		return new MyAnimeList();
	} else if (name == 'MangaUpdates') {
		return new MangaUpdates();
	} else if (name == 'Anilist') {
		return new Anilist();
	} else if (name == 'Kitsu') {
		return new Kitsu();
	} else {
		// if (name == 'AnimePlanet')
		return new AnimePlanet();
	}
}

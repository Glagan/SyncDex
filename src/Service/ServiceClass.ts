import { MyAnimeList } from './MyAnimeList';
import { AnimePlanet } from './AnimePlanet';
import { Kitsu } from './Kitsu';
import { Anilist } from './Anilist';
import { MangaUpdates } from './MangaUpdates';
import { ServiceName, Service } from './Service';
import { Options } from '../Options';

export function ServiceClass(name: ServiceName, options: Options): Service {
	if (name == 'MyAnimeList') {
		return new MyAnimeList(options);
	} else if (name == 'MangaUpdates') {
		return new MangaUpdates(options);
	} else if (name == 'Anilist') {
		return new Anilist(options);
	} else if (name == 'Kitsu') {
		return new Kitsu(options);
	} else {
		// if (name == 'AnimePlanet')
		return new AnimePlanet(options);
	}
}

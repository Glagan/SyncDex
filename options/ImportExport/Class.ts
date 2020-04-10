import { MyMangaDex } from './MyMangaDex';
import { SyncDex } from './SyncDex';
import { MangaDex } from './MangaDex';
import { Anilist } from './Anilist';
import { Kitsu } from './Kitsu';
import { MyAnimeList } from './MyAnimeList';
import { AnimePlanet } from './AnimePlanet';
import { MangaUpdates } from './MangaUpdates';
import { SaveManager, ServiceSave } from '../Manager/Save';

export function ServiceSaveManagerClass(service: string, manager: SaveManager): ServiceSave {
	if (service == 'MyMangaDex') {
		return new MyMangaDex(manager);
	} else if (service == 'SyncDex') {
		return new SyncDex(manager);
	} else if (service == 'MangaDex') {
		return new MangaDex(manager);
	} else if (service == 'MyAnimeList') {
		return new MyAnimeList(manager);
	} else if (service == 'Anilist') {
		return new Anilist(manager);
	} else if (service == 'Kitsu') {
		return new Kitsu(manager);
	} else if (service == 'AnimePlanet') {
		return new AnimePlanet(manager);
	} else {
		// if (service == 'MangaUpdates')
		return new MangaUpdates(manager);
	}
}

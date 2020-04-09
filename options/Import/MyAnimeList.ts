import { ServiceImport, ImportableService } from './ServiceImport';

export class MyAnimeList extends ServiceImport {
	name: ImportableService = ImportableService.MyAnimeList;
	key: string = 'mal';

	start = (): void => {};
}

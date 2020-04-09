import { ServiceImport, ImportableService } from './ServiceImport';

export class MangaUpdates extends ServiceImport {
	name: ImportableService = ImportableService.MangaUpdates;
	key: string = 'mu';

	start = (): void => {};
}

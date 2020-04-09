import { ServiceImport, ImportableService } from './ServiceImport';

export class Kitsu extends ServiceImport {
	name: ImportableService = ImportableService.Kitsu;
	key: string = 'ku';

	start = (): void => {};
}

import { ServiceImport, ImportableService } from './ServiceImport';

export class Anilist extends ServiceImport {
	name: ImportableService = ImportableService.Anilist;
	key: string = 'al';

	start = (): void => {};
}

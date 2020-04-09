import { ServiceImport, ImportableService } from './ServiceImport';

export class MangaDex extends ServiceImport {
	name: ImportableService = ImportableService.MangaDex;
	key: string = 'md';

	start = (): void => {};
}

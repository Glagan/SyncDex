import { ServiceImport, ImportableService } from './ServiceImport';

export class AnimePlanet extends ServiceImport {
	name: ImportableService = ImportableService.AnimePlanet;
	key: string = 'ap';

	start = (): void => {};
}

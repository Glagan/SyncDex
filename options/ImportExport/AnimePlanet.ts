import { ServiceSave } from '../Manager/Save';
import { ServiceImport } from '../Manager/Import';

export class AnimePlanet extends ServiceSave implements ServiceImport {
	name: string = 'AnimePlanet';
	key: string = 'ap';

	import = (): void => {};
	export = (): void => {};
}

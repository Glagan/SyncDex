import { ServiceSave } from '../Manager/Save';
import { ServiceImport } from '../Manager/Import';
import { ServiceExport } from '../Manager/Export';

export class MyAnimeList extends ServiceSave implements ServiceImport, ServiceExport {
	name: string = 'MyAnimeList';
	key: string = 'mal';

	import = (): void => {};
	export = (): void => {};
}

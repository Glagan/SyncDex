import { SaveManager, ServiceSave } from './Save';
import { Options } from '../../src/Options';
import { ServiceSaveManagerClass } from '../ImportExport/Class';

export enum ImportableService {
	MyMangaDex = 'MyMangaDex',
	SyncDex = 'SyncDex',
	MangaDex = 'MangaDex',
	MyAnimeList = 'MyAnimeList',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	AnimePlanet = 'AnimePlanet',
	MangaUpdates = 'MangaUpdates',
}

export interface ServiceImport extends ServiceSave {
	import: () => void;
}

type ServiceList = Record<ImportableService, ServiceImport>;
export class SaveImportManager extends SaveManager {
	headerName: string = 'Import from';
	services: ServiceList;

	constructor(node: HTMLElement, options: Options) {
		super(node, options);
		this.services = {} as ServiceList;
		Object.keys(ImportableService).forEach((value) => {
			this.services[value as ImportableService] = ServiceSaveManagerClass(
				value,
				this
			) as ServiceImport;
		});
		this.reset();
	}

	linkedFunction = (service: string) => {
		return this.services[service as ImportableService].import;
	};

	serviceKeys = () => {
		return Object.keys(ImportableService) as ImportableService[];
	};
}

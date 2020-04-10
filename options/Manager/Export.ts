import { SaveManager, ServiceSave } from './Save';
import { Options } from '../../src/Options';
import { ServiceSaveManagerClass } from '../ImportExport/Class';

export enum ExportableService {
	SyncDex = 'SyncDex',
	MangaDex = 'MangaDex',
	MyAnimeList = 'MyAnimeList',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	AnimePlanet = 'AnimePlanet',
	MangaUpdates = 'MangaUpdates',
}

export interface ServiceExport extends ServiceSave {
	export: () => void;
}

type ServiceList = Record<ExportableService, ServiceExport>;
export class SaveExportManager extends SaveManager {
	headerName: string = 'Export to';
	services: ServiceList;

	constructor(node: HTMLElement, options: Options) {
		super(node, options);
		this.services = {} as ServiceList;
		Object.keys(ExportableService).forEach((value) => {
			this.services[value as ExportableService] = ServiceSaveManagerClass(
				value,
				this
			) as ServiceExport;
		});
		this.reset();
	}

	linkedFunction = (service: string) => {
		return this.services[service as ExportableService].export;
	};

	serviceKeys = () => {
		return Object.keys(ExportableService) as ExportableService[];
	};
}

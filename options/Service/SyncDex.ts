import { ExportedSave } from '../../src/interfaces';
import { AvailableOptions } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { SaveTitle, Title, TitleCollection } from '../../src/Title';
import {
	ImportSummary,
	ManageableService,
	FileImportableModule,
	FileImportFormat,
	FileExportableModule,
} from './Service';
import { Service, ServiceKey, ServiceName, LoginStatus, Status } from '../../src/Service/Service';

class SyncDexService extends Service {
	key: ServiceKey = ServiceKey.SyncDex;
	name: ServiceName = ServiceName.SyncDex;

	loggedIn = async (): Promise<LoginStatus> => {
		return LoginStatus.SUCCESS;
	};
	toStatus = (status: Status): Status => {
		return status;
	};
	fromStatus = (status: Status): Status => {
		return status;
	};
}
class SyncDexImport extends FileImportableModule<ExportedSave, Title> {
	fileType: FileImportFormat = 'JSON';

	isValidTitle = (title: SaveTitle): boolean => {
		return (
			typeof title.s === 'object' &&
			typeof title.st === 'number' &&
			typeof title.p === 'object' &&
			title.p.c !== undefined &&
			(title.sc === undefined || typeof title.sc === 'number') &&
			(title.c === undefined || Array.isArray(title.c)) &&
			(title.sd === undefined || typeof title.sd === 'number') &&
			(title.ed === undefined || typeof title.ed === 'number') &&
			(title.lt === undefined || typeof title.lt === 'number') &&
			(title.lc === undefined || typeof title.lc === 'number') &&
			(title.id === undefined || typeof title.id === 'number') &&
			(title.h === undefined || (typeof title.h === 'object' && title.h.c !== undefined)) &&
			(title.hi === undefined || typeof title.hi === 'number') &&
			(title.lr === undefined || typeof title.lr === 'number') &&
			(title.n === undefined || typeof title.n === 'string')
		);
	};

	handleTitles = async (save: ExportedSave): Promise<Title[]> => {
		let titles: Title[] = [];
		for (const key in save) {
			if (key !== 'options' && key !== 'history') {
				if (!isNaN(parseInt(key)) && this.isValidTitle(save[key])) {
					titles.push(new Title(parseInt(key), Title.toTitle(save[key])));
				}
			}
		}
		return titles;
	};

	convertTitle = async (title: Title, titles: TitleCollection): Promise<boolean> => {
		titles.add(title);
		return true;
	};

	handleOptions = (save: ExportedSave, summary: ImportSummary): void => {
		if (save.options !== undefined) {
			for (const key in save.options) {
				summary.options += this.assignValidOption(
					key as keyof AvailableOptions,
					save.options[key as keyof AvailableOptions]
				);
			}
		}
	};

	handleHistory = (save: ExportedSave, _titles: TitleCollection, summary: ImportSummary): number[] => {
		if (save.history) {
			summary.history = true;
			return save.history;
		}
		return [];
	};
}

class SyncDexExport extends FileExportableModule {
	fileContent = async (): Promise<string> => {
		let data: ExportedSave | undefined = await LocalStorage.getAll();
		if (data && data.options) {
			data.options.tokens = {};
			return JSON.stringify(data);
		}
		return '';
	};
}

export class SyncDex extends ManageableService {
	service: SyncDexService = new SyncDexService();
	activeModule = undefined;
	importModule: SyncDexImport = new SyncDexImport(this);
	exportModule: SyncDexExport = new SyncDexExport(this);
}
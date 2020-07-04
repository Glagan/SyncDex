import { AvailableOptions } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { SaveTitle, Title, TitleCollection, ExportedSave, ServiceKey, ServiceName } from '../../src/Title';
import { ImportSummary, Service, FileImportableModule, FileImportFormat, FileExportableModule } from './Service';
import { AppendableElement, DOM } from '../../src/DOM';

class SyncDexImport extends FileImportableModule<ExportedSave, Title> {
	fileType: FileImportFormat = 'JSON';

	handleTitles = async (save: ExportedSave): Promise<Title[]> => {
		let titles: Title[] = [];
		for (const key in save) {
			if (key !== 'options' && key !== 'history') {
				if (!isNaN(parseInt(key)) && SaveTitle.valid(save[key])) {
					titles.push(new Title(parseInt(key), Title.toTitle(save[key])));
				}
			}
		}
		return titles;
	};

	convertTitles = async (titles: TitleCollection, titleList: Title[]): Promise<number> => {
		titles.add(...titleList);
		return titleList.length;
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

export class SyncDex extends Service {
	readonly key: ServiceKey = ServiceKey.SyncDex;
	readonly name: ServiceName = ServiceName.SyncDex;

	createTitle = (): AppendableElement => {
		return DOM.create('span', {
			class: 'sync',
			textContent: 'Sync',
			childs: [
				DOM.create('span', {
					class: 'dex',
					textContent: 'Dex',
				}),
			],
		});
	};

	activeModule = undefined;
	importModule: SyncDexImport = new SyncDexImport(this);
	exportModule: SyncDexExport = new SyncDexExport(this);
}

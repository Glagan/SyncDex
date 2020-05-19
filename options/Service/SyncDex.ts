import { ExportedSave } from '../../src/interfaces';
import { AvailableOptions } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { SaveTitle, Title, TitleCollection } from '../../src/Title';
import { DOM } from '../../src/DOM';
import { ImportSummary, Service, ExportableModule, FileImportableModule, FileImportFormat } from './Service';
import { ServiceName } from '../Manager/Service';

class SyncDexImport extends FileImportableModule<ExportedSave, Title> {
	fileType: FileImportFormat = 'JSON';

	isValidTitle = (title: SaveTitle): boolean => {
		return (
			typeof title.s === 'object' &&
			typeof title.st === 'number' &&
			typeof title.p === 'object' &&
			title.p.c !== undefined &&
			(title.c === undefined || Array.isArray(title.c)) &&
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

class SyncDexExport extends ExportableModule {
	busy: boolean = false;

	export = async (): Promise<void> => {
		let notification = this.notification(
			'success',
			'Exporting your save file, you can use it as a backup or Import it on another browser/computer.'
		);
		if (this.exportCard && !this.busy) {
			this.busy = true;
			this.exportCard.classList.add('loading');
			let data = await LocalStorage.getAll();
			if (data) {
				data.options.tokens = {};
				let downloadLink = DOM.create('a', {
					style: {
						display: 'none',
					},
					attributes: {
						download: 'SyncDex.json',
						target: '_blank',
						href: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data))}`,
					},
				});
				document.body.appendChild(downloadLink);
				downloadLink.click();
				downloadLink.remove();
			}
			this.exportCard.classList.remove('loading');
			this.busy = false;
		}
		DOM.append(notification, DOM.space(), this.resetButton());
	};
}

export class SyncDex extends Service {
	name: ServiceName = ServiceName.SyncDex;
	key: string = 'sc';

	activeModule = undefined;
	importModule: FileImportableModule<ExportedSave, Title> = new SyncDexImport(this);
	exportModule: ExportableModule = new SyncDexExport(this);
}

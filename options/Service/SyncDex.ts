import { ExportedSave } from '../../src/interfaces';
import { Options, AvailableOptions } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { Title, TitleCollection } from '../../src/Title';
import { DOM } from '../../src/DOM';
import { Checkbox, FileInput, ImportSummary, ImportType, Service, ImportableModule, ExportableModule } from './Service';
import { ServiceName } from '../Manager/Service';

class SyncDexImport extends ImportableModule {
	importType: ImportType = ImportType.FILE;
	busy: boolean = false;
	form?: HTMLFormElement;
	convertOptions = undefined;

	fileToTitles = <T extends ExportedSave>(file: T): TitleCollection => {
		return new TitleCollection();
	};

	import = async (): Promise<void> => {
		this.notification('success', 'Select your SyncDex save file.');
		this.form = this.createForm(
			[
				new Checkbox('override', 'Erase current Save'),
				new FileInput('file', 'SyncDex save file', 'application/json'),
			],
			(event) => this.handle(event)
		);
	};

	handle = (event: Event): void => {
		event.preventDefault();
		if (!this.form) return;
		const merge = this.form.override.checked == false;
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result == 'string') {
				try {
					let summary: ImportSummary = {
						options: 0,
						history: false,
						total: 0,
						invalid: 0,
					};
					const titleList: string[] = [];
					let titles: TitleCollection = new TitleCollection();
					let history: number[] | undefined = undefined;
					let data = JSON.parse(reader.result) as ExportedSave;
					// Options
					if (data.options !== undefined) {
						for (const key in data.options) {
							summary.options += this.assignValidOption(
								key as keyof AvailableOptions,
								data.options[key as keyof AvailableOptions]
							);
						}
					}
					// Merge or override Titles
					Object.keys(data).forEach((value): void => {
						if (value !== 'options' && value !== 'history') {
							if (!isNaN(parseInt(value)) && this.isValidTitle(data[value])) {
								titleList.push(value);
								titles.add(new Title(parseInt(value), data[value]));
							} else {
								summary.invalid++;
							}
							summary.total++;
						}
					});
					if (merge) {
						titles.merge(await TitleCollection.get(titles.ids));
					}
					// History
					if (Options.biggerHistory && data.history) {
						history = [];
						if (merge) {
							const currentHistory = await LocalStorage.get('history');
							if (currentHistory !== undefined) {
								history.concat(data.history);
							} else {
								history = data.history;
							}
						} else {
							history = data.history;
						}
						summary.history = false;
					}
					// Check if we did not import anything at all
					if (
						(summary.total == 0 || summary.total == summary.invalid) &&
						summary.options == 0 &&
						!summary.history
					) {
						throw 'Invalid file !';
					}
					// Save
					if (!merge) {
						await LocalStorage.clear();
					}
					await titles.save();
					if (history) {
						await LocalStorage.set('history', history);
					}
					await Options.save();
					this.displaySummary(summary);
					// this.manager.reload(); // TODO: Reload
				} catch (error) {
					console.error(error);
					this.notification('danger', 'Invalid file !');
				}
			} else {
				this.notification('danger', 'Unknown error, wrong file type.');
			}
		};
		if (this.form.file.files.length > 0) {
			reader.readAsText(this.form.file.files[0]);
		} else {
			this.notification('danger', 'No file !');
		}
	};

	isValidTitle = (title: Record<string, any>): boolean => {
		return (
			typeof title.s === 'object' &&
			typeof title.st === 'number' &&
			typeof title.p === 'object' &&
			Array.isArray(title.c) &&
			(title.lt === undefined || typeof title.lt === 'number') &&
			(title.lc === undefined || typeof title.lc === 'number') &&
			(title.id === undefined || typeof title.id === 'number') &&
			(title.lr === undefined || typeof title.lr === 'number') &&
			(title.n === undefined || typeof title.n === 'string')
		);
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
	importModule: ImportableModule = new SyncDexImport(this);
	exportModule: ExportableModule = new SyncDexExport(this);
}

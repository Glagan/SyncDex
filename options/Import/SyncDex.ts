import { ImportableService } from './ServiceImport';
import { Title, ExportedTitles, ExportedSave } from '../../src/interfaces';
import { DefaultOptions } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { ExtensionServiceImport } from './ExtensionServiceImport';

export class SyncDex extends ExtensionServiceImport {
	name: ImportableService = ImportableService.SyncDex;
	key: string = 'sc';

	form?: HTMLFormElement;

	start = (): void => {
		this.manager.clear();
		this.manager.header('Select your SyncDex save file');
		this.form = this.manager.form(
			[
				{
					type: 'checkbox',
					text: 'Override instead of merge',
					name: 'override',
				},
				{
					type: 'file',
					name: 'file',
				},
			],
			(event) => this.handle(event)
		);
	};

	handle = (event: Event): void => {
		event.preventDefault();
		this.removeError();
		if (!this.form) return;
		const merge = this.form.override.checked == false;
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result == 'string') {
				try {
					const titleList: string[] = [];
					let currentSave: ExportedSave | undefined = {} as ExportedSave;
					const newSave = {} as ExportedSave;
					let data = JSON.parse(reader.result) as ExportedSave;
					// Options
					if (data.options !== undefined) {
						Object.keys(data.options).forEach((value) => {
							const key = value as keyof DefaultOptions;
							this.manager.options.set(key, (data.options as DefaultOptions)[key]);
						});
					}
					// Merge or override Titles
					Object.keys(data).forEach((value): void => {
						if (value !== 'options' && value !== 'history') {
							titleList.push(value);
							newSave[value] = data[value];
						}
					});
					if (merge) {
						currentSave = await LocalStorage.getAll<Title>(titleList);
						await this.mergeTitles(currentSave, newSave);
					}
					// History
					newSave.history = data.history;
					if (this.manager.options.biggerHistory && data.history) {
						if (merge) {
							this.mergeHistory(currentSave, newSave);
						} else {
							newSave.history = data.history;
						}
					}
					// Save everything
					if (!merge) {
						await LocalStorage.clear();
					}
					await LocalStorage.raw(newSave);
					await this.manager.options.save();
					this.displaySuccess('Save successfully imported !');
				} catch (error) {
					this.displayError('Invalid file !');
				}
			} else {
				this.displayError('Unknown error, wrong file type.');
			}
		};
		if (this.form.file.files.length > 0) {
			reader.readAsText(this.form.file.files[0]);
		} else {
			this.displayError('No file !');
		}
	};
}

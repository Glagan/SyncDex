import { Title, ExportedSave } from '../../src/interfaces';
import { AvailableOptions, Options } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { ExtensionSave } from './ExtensionSave';

export class SyncDex extends ExtensionSave {
	name: string = 'SyncDex';
	key: string = 'sc';

	form?: HTMLFormElement;

	import = (): void => {
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

	export = (): void => {};

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
						for (const key in data.options) {
							Options.set(key as keyof AvailableOptions, data.options[key as keyof AvailableOptions]);
						}
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
					if (Options.biggerHistory && data.history) {
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
					await Options.save();
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

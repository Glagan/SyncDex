import { ExportedSave } from '../../src/interfaces';
import { AvailableOptions, Options } from '../../src/Options';
import { LocalStorage } from '../../src/Storage';
import { ExtensionSave } from './ExtensionSave';
import { Title } from '../../src/Title';
import { DOM } from '../../src/DOM';

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
					const newSave = {} as ExportedSave;
					const titleList: string[] = [];
					let titles: Title[] = [];
					let data = JSON.parse(reader.result) as ExportedSave;
					// Options
					if (data.options !== undefined) {
						for (const key in data.options) {
							Options.set(
								key as keyof AvailableOptions,
								data.options[key as keyof AvailableOptions]
							);
						}
					}
					// Merge or override Titles
					Object.keys(data).forEach((value): void => {
						if (value !== 'options' && value !== 'history') {
							titleList.push(value);
							titles.push(new Title(parseInt(value), data[value]));
						}
					});
					if (merge) {
						this.mergeTitles(await Title.getAll(titleList), titles);
					}
					// History
					if (Options.biggerHistory && data.history) {
						newSave.history = [];
						if (merge) {
							const currentHistory = await LocalStorage.get('history');
							if (currentHistory !== undefined) {
								newSave.history.concat(data.history);
							} else {
								newSave.history = data.history;
							}
						} else {
							newSave.history = data.history;
						}
					}
					// Add each titles to the save
					for (let index = 0, len = titles.length; index < len; index++) {
						const title = titles[index];
						newSave[title.id] = title.toSave();
					}
					// Save
					if (!merge) {
						await LocalStorage.clear();
					}
					await LocalStorage.raw(newSave);
					await Options.save();
					// TODO: Reload everything
					this.end();
				} catch (error) {
					console.error(error);
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

	end = (): void => {
		this.manager.clear();
		this.manager.header('Done Importing SyncDex');
		this.displaySuccess([
			DOM.text('Save successfully imported !'),
			DOM.space(),
			DOM.create('button', {
				class: 'action',
				textContent: 'Go Back',
				events: {
					click: () => this.manager.reset(),
				},
			}),
		]);
	};
}

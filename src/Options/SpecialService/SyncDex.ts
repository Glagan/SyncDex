import { DOM } from '../../Core/DOM';
import { log } from '../../Core/Log';
import { ModuleInterface } from '../../Core/ModuleInterface';
import { Options } from '../../Core/Options';
import { Storage } from '../../Core/Storage';
import { LocalTitle, TitleCollection } from '../../Core/Title';
import { dateFormat } from '../../Core/Utility';
import { ServiceKey } from '../../Service/Keys';
import { History } from '../../Core/History';
import { SpecialService } from '../SpecialService';
import { Updates } from '../../Core/Updates';

export class SyncDexImport extends SpecialService {
	async handleFile(data: StorageValues, moduleInterface: ModuleInterface) {
		// Find all Titles
		let message = moduleInterface.message('loading', 'Loading SyncDex Titles...');
		const collection = new TitleCollection();
		for (const key in data) {
			if (!Storage.isSpecialKey(key)) {
				// Check if SyncDexTitle keys are valid and contain a valid SyncDexTitle
				const id = parseInt(key);
				if (!isNaN(id) && LocalTitle.valid(data[key])) {
					collection.add(new LocalTitle(id, LocalTitle.fromSave(data[key])));
				}
			}
		}
		message.classList.remove('loading');
		if (collection.length == 0) moduleInterface.message('warning', 'No Titles found !');
		if (moduleInterface.doStop) return moduleInterface.complete();

		// Add History
		message = moduleInterface.message('loading', 'Loading History...');
		let history: HistoryObject | undefined = undefined;
		if (data.history) {
			// Check if it's valid
			if (
				(data.history.last === undefined || typeof data.history.last === 'number') &&
				(data.history.page === undefined || typeof data.history.page === 'number') &&
				Array.isArray(data.history.ids)
			) {
				data.history.ids = Array.from(new Set(data.history.ids));
				history = data.history;
				moduleInterface.message('default', `Found ${data.history.ids.length} Titles in the History.`);
			} else moduleInterface.message('warning', 'History found but invalid and not Imported !');
		}
		message.classList.remove('loading');
		if (moduleInterface.doStop) return moduleInterface.complete();

		// Add Options
		if (data.options !== undefined) {
			const badOptions: string[] = [];
			let total: number = 0;
			for (const key in data.options) {
				if (this.optionExists(key)) {
					if (this.assignValidOption(key, data.options[key])) total++;
					else badOptions.push(key);
				} else badOptions.push(key);
			}
			moduleInterface.message(
				'default',
				`Imported ${total} Options${
					badOptions.length > 0 ? ` (Found ${badOptions.length} bad options: ${badOptions.join(', ')})` : ''
				}.`
			);
		} else moduleInterface.message('warning', 'No Options found !');

		// Mochi
		if (this.options.mochi.active) {
			await this.mochi(collection, moduleInterface);
			if (moduleInterface.doStop) return moduleInterface.complete();
		}

		// Save
		message = moduleInterface.message('loading', 'Saving...');
		if (!this.options.merge.active) {
			await Storage.clear();
			if (history) await Storage.set(StorageUniqueKey.History, history);
		} else if (collection.length > 0) {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		if (history && this.options.merge.active) {
			await History.load();
			History.ids = [...new Set(History.ids.concat(history.ids))];
			await History.save();
		}
		// Add other keys that can be imported
		const otherValues: { logs?: LogLine[]; lastSync?: number; import?: number | string[] } = {};
		if (data.logs) otherValues.logs = data.logs;
		if (data.lastSync) otherValues.lastSync = data.lastSync;
		if (data.import && typeof data.import === 'number') otherValues.import = data.import;
		if (Object.keys(otherValues).length > 0) {
			await Storage.set(otherValues);
		}
		await Options.save();
		await Updates.apply();

		// Save
		await collection.persist();
		moduleInterface.message;
		message.classList.remove('loading');
		moduleInterface.message('success', `Imported ${collection.length} Titles, History and Options !`);
		this.reload();
		moduleInterface.complete();
	}

	async start() {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.createOptions(this.options);
		moduleInterface.setStyle(
			DOM.create('span', {
				class: 'sync',
				textContent: 'Sync',
				childs: [
					DOM.create('span', {
						class: 'dex',
						textContent: 'Dex',
					}),
				],
			}),
			ServiceKey.SyncDex
		);

		// Add File input
		const inputId = `file_${ServiceKey.SyncDex}`;
		DOM.append(
			moduleInterface.form,
			DOM.create('h2', {
				childs: [DOM.create('label', { class: '', textContent: 'Save File', htmlFor: inputId })],
			}),
			DOM.create('div', {
				class: 'row-parameter',
				childs: [
					DOM.create('input', {
						name: 'save',
						id: inputId,
						type: 'file',
						required: true,
						accept: 'application/json',
					}),
				],
			})
		);

		// Show the Modal
		const form = moduleInterface.form;
		moduleInterface.bindFormSubmit(() => {
			// Check if there is a file and set options
			if (!form.save || form.save.files.length < 1) {
				moduleInterface.message('warning', 'No file !');
				return moduleInterface.complete();
			}
			moduleInterface.setOptionsValues(this.options);

			// Read File
			let message = moduleInterface.message('loading', 'Loading file...');
			var reader = new FileReader();
			reader.onload = async (): Promise<any> => {
				if (typeof reader.result !== 'string') {
					if (message) message.classList.remove('loading');
					message = moduleInterface.message('warning', 'Unknown error, wrong file type.');
					return moduleInterface.complete();
				}
				let data: StorageValues;
				try {
					data = JSON.parse(reader.result) as StorageValues;
					if (message) message.classList.remove('loading');
					this.handleFile(data, moduleInterface);
				} catch (error) {
					await log(error);
					if (message) message.classList.remove('loading');
					message = moduleInterface.message('warning', 'Invalid file !');
					moduleInterface.complete();
				}
			};
			reader.readAsText(form.save.files[0]);
		});
		moduleInterface.modal.show();
	}
}

export class SyncDexExport extends SpecialService {
	async start() {
		const data = await Storage.get();
		if (data.options) {
			delete (data.options as any).tokens;
			delete data.importInProgress;
			delete data.saveSyncInProgress;
			delete data.dropboxState;
			delete data.saveSync;
			const blob = new Blob([JSON.stringify(data)], { type: 'application/json;charset=utf-8' });
			const href = URL.createObjectURL(blob);
			const downloadLink = DOM.create('a', {
				css: { display: 'none' },
				download: `SyncDex_${dateFormat(new Date(), true).replace(/(\s|:)+/g, '_')}.json`,
				target: '_blank',
				href: href,
			});
			document.body.appendChild(downloadLink);
			downloadLink.click();
			downloadLink.remove();
			URL.revokeObjectURL(href);
			SimpleNotification.success({ title: 'Save Exported' });
		}
	}
}

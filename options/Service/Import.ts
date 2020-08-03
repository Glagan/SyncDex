import { Checkbox, Summary, SaveModule } from './Service';
import { DOM } from '../../src/DOM';
import { TitleCollection, ServiceKeyType, ExternalTitle } from '../../src/Title';
import { LocalStorage } from '../../src/Storage';
import { Options } from '../../src/Options';
import { Mochi } from '../../src/Mochi';

interface ImportState {
	current: number;
	max: number;
}

export class ImportSummary extends Summary {
	options: number = 0;
	history: boolean = false;
}

export type FileImportFormat = 'JSON' | 'XML';

export abstract class ImportableModule extends SaveModule<ImportSummary> {
	summary: ImportSummary = new ImportSummary();

	reset = (): void => {
		this.summary = new ImportSummary();
	};

	cancel = (forced = false): void => {
		this.notification(
			'warning',
			forced ? 'The import was cancelled, nothing was saved' : 'You cancelled the import, nothing was saved.'
		);
		this.complete();
	};

	displaySummary = (): void => {
		// this.notification('success', `Done Importing ${this.service.serviceName} !`);
		if (this.summary.total != this.summary.valid) {
			const content = DOM.create('p', {
				textContent: `${this.summary.failed.length} titles were not imported since they had invalid or missing properties.`,
			});
			const notification = this.notification('warning', [content]);
			if (this.summary.failed.length > 0) {
				const failedBlock = DOM.create('ul', { class: 'failed' });
				for (const name of this.summary.failed) {
					failedBlock.appendChild(DOM.create('li', { textContent: name }));
				}
				DOM.append(
					content,
					DOM.create('button', {
						class: 'micro',
						textContent: 'Show',
						events: {
							click: (event) => {
								event.preventDefault();
								if (!failedBlock.classList.contains('open')) {
									failedBlock.classList.add('open');
									failedBlock.classList.remove('closed');
								} else {
									failedBlock.classList.remove('open');
									failedBlock.classList.add('closed');
								}
							},
						},
					}),
					failedBlock
				);
			}
		}
		let report = `Successfully imported ${this.summary.valid} titles`;
		if (this.summary.options > 0)
			report += `${this.summary.history ? ', ' : ' and '} ${this.summary.options} Options`;
		if (this.summary.history) report += ` and History`;
		report += ` in ${this.summary.totalTime()} !`;
		this.notification('success', report);
	};
}

export abstract class FileImportableModule<T extends Object | Document, R extends Object> extends ImportableModule {
	abstract fileType: FileImportFormat;
	abstract handleTitles(save: T | Document): Promise<R[]>;
	abstract convertTitles(titles: TitleCollection, titleList: R[]): Promise<number>;
	abstract handleOptions?(save: T | Document, summary: ImportSummary): void;
	abstract handleHistory?(save: T | Document, titles: TitleCollection, summary: ImportSummary): number[];
	perConvert: number = 250;

	acceptedFileType = (): string => {
		return 'application/json';
	};

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		const inputId = `file_${this.service.serviceName}`;
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		const options = Checkbox.make('merge', 'Merge with current save');
		Checkbox.make('checkServices', 'Check Services ID with Mochi after Import', options);
		form.appendChild(options);
		form.appendChild(
			DOM.create('h2', {
				childs: [DOM.create('label', { class: '', textContent: 'Save File', htmlFor: inputId })],
			})
		);
		DOM.append(
			form,
			DOM.create('div', {
				class: 'row-parameter',
				childs: [
					DOM.create('input', {
						name: 'save',
						id: inputId,
						type: 'file',
						required: true,
						accept: this.acceptedFileType(),
					}),
				],
			})
		);
		return form;
	};

	// TODO: Notifications are after the body
	handle = async (form: HTMLFormElement): Promise<void> => {
		let notification: HTMLElement;
		if (!form.save || form.save.files.length < 1) {
			notification = this.notification('warning', 'No file !');
			return;
		}
		notification = this.notification('loading', 'Loading file...');
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result !== 'string') {
				if (notification) notification.classList.remove('loading');
				notification = this.notification('warning', 'Unknown error, wrong file type.');
				return;
			}
			let data: T | Document;
			try {
				if (this.fileType == 'JSON') {
					data = JSON.parse(reader.result) as T;
				} else {
					const parser: DOMParser = new DOMParser();
					data = parser.parseFromString(reader.result, 'application/xml');
				}
			} catch (error) {
				console.error(error);
				if (notification) notification.classList.remove('loading');
				notification = this.notification('warning', 'Invalid file !');
				return;
			}
			if (notification) notification.classList.remove('loading');
			this.import(data, form.merge.checked, form.checkServices.checked);
		};
		reader.readAsText(form.save.files[0]);
	};

	import = async (data: T | Document, merge: boolean, checkServices: boolean): Promise<void> => {
		this.displayActive();
		// Import everything first
		let notification = this.notification('loading', 'Importing Titles');
		const titles: R[] = await this.handleTitles(data);
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Abort if there is nothing
		this.summary.total = titles.length;
		if (this.summary.total == 0) {
			this.notification('success', 'No titles found !');
			return this.cancel(true);
		}
		// Convert Service titles to Title
		let collection = new TitleCollection();
		notification = this.notification('loading', '');
		let offset = 0;
		let max = titles.length / this.perConvert;
		let currentTitle = 0;
		for (let i = 0; !this.doStop && i < max; i++) {
			const titleList = titles.slice(offset, offset + this.perConvert);
			offset += this.perConvert;
			currentTitle = Math.min(this.summary.total, currentTitle + this.perConvert);
			(notification.querySelector(
				'.content p'
			) as HTMLElement).textContent = `Converting title ${currentTitle} out of ${this.summary.total}.`;
			const converted = await this.convertTitles(collection, titleList);
			this.summary.valid += converted;
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Handle options and history
		if (this.handleOptions) {
			notification = this.notification('default', 'Importing Options');
			this.handleOptions(data, this.summary);
		}
		let history: number[] = [];
		if (this.handleHistory) {
			notification = this.notification('default', 'Importing History');
			history = this.handleHistory(data, collection, this.summary);
		}
		// Merge
		if (!merge) {
			await LocalStorage.clear();
		} else if (collection.length > 0) {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		// Mochi
		if (checkServices) {
			await this.mochiCheck(collection);
			if (this.doStop) return;
		}
		// We're double checking and saving only at the end in case of abort
		notification = this.notification('loading', 'Saving...');
		collection.save();
		if (this.handleHistory && history.length > 0) {
			await LocalStorage.set('history', history);
		}
		await Options.save(); // Always save -- options are deleted in LocalStorage
		if (this.handleOptions) {
			this.service.manager.reloadOptions(); // TODO: Reload
		}
		notification.remove();
		this.displaySummary();
		this.complete();
	};
}

export interface PersistableMedia {
	id: ServiceKeyType;
	name?: string;
	persist(): Promise<RequestStatus>;
	mochi: number | string;
}

export abstract class APIImportableModule extends ImportableModule {
	state: ImportState = { current: 0, max: 1 };
	convertTitles?(titles: TitleCollection, titleList: PersistableMedia[]): Promise<number>;
	abstract handlePage(): Promise<PersistableMedia[] | false>;
	perConvert: number = 250;
	preMain?(): Promise<boolean>;

	reset = (): void => {
		this.state = { current: 0, max: 1 };
		this.summary = new ImportSummary();
	};

	getNextPage = (): boolean => {
		if (this.state.current < this.state.max || this.state.current == 0) {
			this.state.current++;
			return true;
		}
		return false;
	};

	importProgress = (): string => {
		return `Importing page ${this.state.current} out of ${this.state.max}.`;
	};

	convertProgress = (): string => {
		const current = Math.min(this.summary.total, this.state.current + this.perConvert);
		return `Converting title ${current} out of ${this.summary.total}.`;
	};

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		const options = Checkbox.make('merge', 'Merge with current save');
		Checkbox.make('checkServices', 'Check Services ID with Mochi after Import', options);
		form.appendChild(options);
		return form;
	};

	handle = async (form: HTMLFormElement): Promise<void> => {
		this.displayActive();
		const loginProgress = DOM.create('p', { textContent: 'Checking login status...' });
		let notification = this.notification('loading', [loginProgress]);
		// Check login status
		if (!(await this.checkLogin())) {
			notification.classList.remove('loading');
			this.notification('warning', 'You are not logged in !');
			return this.cancel(true);
		}
		notification.classList.remove('loading');
		DOM.append(loginProgress, DOM.space(), DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		let titles: PersistableMedia[] = [];
		if (this.preMain) {
			if (!(await this.preMain())) {
				return this.cancel(true);
			}
		}
		if (this.doStop) return this.cancel();
		let progress = DOM.create('p');
		notification = this.notification('loading', [progress]);
		// Fetch each pages to get a list of titles in the Service format
		while (!this.doStop && this.getNextPage() !== false) {
			progress.textContent = this.importProgress();
			let tmp: PersistableMedia[] | false = await this.handlePage();
			if (tmp === false) {
				notification.classList.remove('loading');
				return this.cancel(true);
			}
			titles.push(...tmp);
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		this.summary.total = titles.length;
		if (this.summary.total == 0) {
			this.notification('success', 'No titles found !');
			return this.cancel(true);
		}
		this.notification('success', `Found a total of ${this.summary.total} Titles.`);
		// Find MangaDex IDs from ServiceTitle
		progress = DOM.create('p');
		notification = this.notification('loading', [progress]);
		let collection = new TitleCollection();
		this.state.current = 0;
		this.state.max = Math.ceil(this.summary.total / this.perConvert);
		for (let i = 0; !this.doStop && i < this.state.max; i++) {
			const titleList = titles.slice(this.state.current, this.state.current + this.perConvert);
			this.state.current += this.perConvert;
			progress.textContent = this.convertProgress();
			if (this.convertTitles) {
				const converted = await this.convertTitles(collection, titleList);
				this.summary.valid += converted;
			} else {
				const connections = await Mochi.findMany(
					titleList.map((t) => t.mochi),
					this.service.serviceName
				);
				let found: (number | string)[] = [];
				if (connections !== undefined) {
					for (const key in connections) {
						const connection = connections[key];
						if (connection['md'] !== undefined) {
							const id = parseInt(key);
							const title = titleList.find((t) => t.mochi == id) as ExternalTitle | undefined;
							if (title) {
								title.mangaDex = connection['md'];
								const convertedTitle = title.toLocalTitle();
								if (convertedTitle) {
									collection.add(convertedTitle);
									this.summary.valid++;
								}
								found.push(title.mochi);
							}
						}
					}
				}
				// Add missing titles to the failed Summary
				const noIds = titleList.filter((t) => found.indexOf(t.mochi) < 0);
				this.summary.failed.push(...noIds.filter((t) => t.name !== undefined).map((t) => t.name as string));
			}
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Merge
		if (!form.merge.checked) {
			await LocalStorage.clear();
		} else {
			collection.merge(await TitleCollection.get(collection.ids));
		}
		// Mochi
		if (form.checkServices.checked) {
			await this.mochiCheck(collection);
			if (this.doStop) return;
		}
		// Done !
		notification = this.notification('loading', 'Saving...');
		await Options.save(); // Always save -- options are deleted in LocalStorage
		await collection.save();
		notification.remove();
		this.displaySummary();
		this.complete();
	};
}

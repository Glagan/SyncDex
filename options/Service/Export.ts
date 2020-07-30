import { duration, Checkbox, Summary, SaveModule } from './Service';
import { DOM } from '../../src/DOM';
import { TitleCollection, Title, ActivableKey, LocalTitle } from '../../src/Title';

export abstract class ExportableModule extends SaveModule {
	summary: Summary = new Summary();

	reset = (): void => {
		this.summary = new Summary();
	};

	/**
	 * By default, select all titles with a Service key for the current service and a status
	 */
	selectTitles = async (titleCollection: TitleCollection): Promise<LocalTitle[]> => {
		return titleCollection.collection.filter((title) => {
			const id = title.services[this.service.key as ActivableKey];
			return id !== undefined && id > 0 && title.status !== Status.NONE;
		});
	};

	cancel = (forced = false): void => {
		this.notification('warning', forced ? 'The export was cancelled.' : 'You cancelled the export.');
		this.complete();
	};

	displaySummary = (): void => {
		if (this.summary.total != this.summary.valid) {
			this.notification(
				'warning',
				`${
					this.summary.total - this.summary.valid
				} titles were not exported since they had invalid or missing properties.`
			);
		}
		this.notification('success', `Exported ${this.summary.valid} titles in ${this.summary.totalTime()} !`);
	};
}

export abstract class FileExportableModule extends ExportableModule {
	abstract fileContent(): Promise<string>;

	createForm = (): HTMLFormElement => {
		return DOM.create('form', { class: 'body' });
	};

	handle = async (_form: HTMLFormElement): Promise<void> => {
		this.displayActive();
		const progress = DOM.create('p', { textContent: 'Creating file...' });
		let notification = this.notification('loading', [progress]);
		let save = await this.fileContent();
		DOM.append(progress, DOM.space(), DOM.text('done !'));
		const blob = new Blob([save], { type: 'application/json;charset=utf-8' });
		const href = URL.createObjectURL(blob);
		notification.classList.remove('loading');
		if (save === '') {
			this.notification('warning', `There was an error while creating your file.`);
			return this.cancel(true);
		}
		let downloadLink = DOM.create('a', {
			css: {
				display: 'none',
			},
			download: 'SyncDex.json',
			target: '_blank',
			href: href,
		});
		document.body.appendChild(downloadLink);
		downloadLink.click();
		downloadLink.remove();
		URL.revokeObjectURL(href);
		this.notification('success', 'Save exported !');
		this.complete();
	};
}

export abstract class APIExportableModule extends ExportableModule {
	abstract exportTitle(title: LocalTitle): Promise<boolean>;
	preMain?(titles: LocalTitle[]): Promise<boolean>;

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		form.appendChild(Checkbox.make('checkServices', 'Check Services ID with Mochi before Export'));
		return form;
	};

	handle = async (form: HTMLFormElement): Promise<void> => {
		this.displayActive();
		// Check login status
		const loginProgress = DOM.create('p', { textContent: 'Checking login status...' });
		let notification = this.notification('loading', [loginProgress]);
		if (!(await this.checkLogin())) {
			notification.classList.remove('loading');
			this.notification('warning', 'You are not logged in !');
			return this.cancel(true);
		}
		notification.classList.remove('loading');
		DOM.append(loginProgress, DOM.space(), DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		// Check Services
		const collection = await TitleCollection.get();
		if (form.checkServices.checked) {
			await this.mochiCheck(collection);
			collection.save();
			if (this.doStop) return;
		}
		// Select local titles
		notification = this.notification('loading', 'Loading Titles...');
		let titles = await this.selectTitles(collection);
		notification.classList.remove('loading');
		if (titles.length == 0) {
			this.notification('default', `You don't have any Titles in your list that can be exported.`);
			return this.cancel(true);
		}
		this.summary.total = titles.length;
		if (this.preMain) {
			if (!(await this.preMain(titles))) {
				return this.cancel(true);
			}
		}
		if (this.doStop) return this.cancel();
		// Export one by one...
		let progress = DOM.create('p');
		notification = this.notification('loading', [progress]);
		let average = 0;
		for (let i = 0; !this.doStop && i < this.summary.total; i++) {
			const title = titles[i];
			let currentProgress = '';
			if (title.name) {
				currentProgress = `Exporting title ${title.name} (${i + 1} out of ${this.summary.total}).`;
			} else {
				currentProgress = `Exporting title ${i + 1} out of ${this.summary.total}.`;
			}
			if (average > 0) {
				currentProgress += `\nEstimated time remaining: ${duration((this.summary.total - i) * average)}.`;
			}
			progress.textContent = currentProgress;
			const before = Date.now();
			if (await this.exportTitle(title)) {
				this.summary.valid++;
			} else if (title.name) {
				this.summary.failed.push(title.name);
			}
			if (average == 0) average = Date.now() - before;
			else average = (average + (Date.now() - before)) / 2;
		}
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Done
		this.displaySummary();
		this.complete();
	};
}

export abstract class BatchExportableModule<T> extends ExportableModule {
	abstract generateBatch(titles: LocalTitle[]): Promise<T>;
	abstract sendBatch(batch: T, summary: Summary): Promise<boolean>;

	createForm = (): HTMLFormElement => {
		const form = DOM.create('form', { class: 'body' });
		form.appendChild(DOM.create('h2', { textContent: 'Options' }));
		form.appendChild(Checkbox.make('checkServices', 'Check Services ID with Mochi before Export'));
		return form;
	};

	handle = async (form: HTMLFormElement): Promise<void> => {
		this.displayActive();
		// Check login status
		const loginProgress = DOM.create('p', { textContent: 'Checking login status...' });
		let notification = this.notification('loading', [loginProgress]);
		if (!(await this.checkLogin())) {
			notification.classList.remove('loading');
			this.notification('warning', 'You are not logged in !');
			return this.cancel(true);
		}
		notification.classList.remove('loading');
		DOM.append(loginProgress, DOM.space(), DOM.text('logged in !'));
		if (this.doStop) return this.cancel();
		// Check Services
		const collection = await TitleCollection.get();
		if (form.checkServices.checked) {
			await this.mochiCheck(collection);
			collection.save();
			if (this.doStop) return;
		}
		// Select local titles
		notification = this.notification('loading', 'Loading Titles...');
		let titles = await this.selectTitles(collection);
		notification.classList.remove('loading');
		if (titles.length == 0) {
			this.notification('default', `You don't have any Titles in your list that can be exported.`);
			return this.cancel(true);
		}
		// Generate batch
		this.summary.total = titles.length;
		notification = this.notification('loading', `Generating batch with ${titles.length} titles.`);
		const batch = await this.generateBatch(titles);
		notification.classList.remove('loading');
		if (this.doStop) return this.cancel();
		// Export batch
		notification = this.notification('loading', 'Sending batch...');
		const batchResult = await this.sendBatch(batch, this.summary);
		notification.classList.remove('loading');
		// Done
		if (batchResult === false) {
			this.notification('warning', 'There was an error while exporting the batch, maybe retry later.');
			return this.cancel(true);
		}
		this.displaySummary();
		this.complete();
	};
}

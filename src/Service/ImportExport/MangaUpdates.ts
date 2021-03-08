import { DOM } from '../../Core/DOM';
import { duration, ExportModule, ImportModule } from '../../Core/Module';
import { Http } from '../../Core/Http';
import { FoundTitle } from '../../Core/Title';
import { MangaUpdatesTitle } from '../Class/MangaUpdates';
import { ActivableKey } from '../Keys';
import { Services } from '../Class/Map';
import { LocalTitle } from '../../Core/Title';

export class MangaUpdatesImport extends ImportModule {
	static lists: string[] = ['read', 'wish', 'complete', 'unfinished', 'hold'];

	progressFromNode(node: HTMLElement | null): number {
		if (node !== null) {
			return parseInt((node.textContent as string).slice(2));
		}
		return 0;
	}

	async execute(): Promise<boolean> {
		const progress = DOM.create('p', { textContent: 'Fetching all titles...' });
		const message = this.interface?.message('loading', [progress]);
		const parser = new DOMParser();

		// Get each pages
		let max = MangaUpdatesImport.lists.length;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const page = MangaUpdatesImport.lists[current];
			progress.textContent = `Fetching all titles... Page ${current + 1} out of ${max}.`;
			const response = await Http.get(`https://www.mangaupdates.com/mylist.html?list=${page}`, {
				credentials: 'include',
			});
			if (response.ok && response.body && response.body.indexOf('You must be a user to access this page.') < 0) {
				const body = parser.parseFromString(response.body, 'text/html');
				const rows = body.querySelectorAll(`div[id^='r']`);
				const status = MangaUpdatesTitle.listToStatus(page);
				for (const row of rows) {
					const scoreLink = row.querySelector(`a[title='Update Rating']`);
					let score: number | undefined;
					if (scoreLink !== null && scoreLink.textContent) {
						score = parseInt(scoreLink.textContent) * 10;
						if (isNaN(score)) score = undefined;
					}
					const name = row.querySelector<HTMLElement>(`a[title='Series Info']`);
					if (!name || !name.textContent) continue;
					// No Max Chapter in lists
					this.found.push({
						key: { id: parseInt(row.id.slice(1)) },
						progress: {
							chapter: this.progressFromNode(row.querySelector(`a[title='Increment Chapter']`)),
							volume: this.progressFromNode(row.querySelector(`a[title='Increment Volume']`)),
						},
						status: MangaUpdatesTitle.toStatus(status),
						score: score,
						name: name.textContent,
						mochiKey: parseInt(row.id.slice(1)),
					});
				}
			}
		}
		message?.classList.remove('loading');

		return this.interface ? !this.interface.doStop : true;
	}
}

export class MangaUpdatesExport extends ExportModule {
	onlineList: { [key: string]: FoundTitle | undefined } = {};

	// We need the status of each titles before to move them from lists to lists
	// Use ImportModule and get a list of FoundTitle
	async preExecute(titles: LocalTitle[]): Promise<boolean> {
		const importModule = new MangaUpdatesImport(Services[ActivableKey.MangaUpdates]);
		importModule.options.save.default = false;
		await importModule.run();
		this.onlineList = {};
		for (const title of importModule.found) {
			this.onlineList[title.key.id!] = title;
		}
		return true;
	}

	async execute(titles: LocalTitle[]): Promise<boolean> {
		const max = titles.length;
		this.interface?.message('default', `Exporting ${max} Titles...`);
		const progress = DOM.create('p');
		const message = this.interface?.message('loading', [progress]);
		let average = 0;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const localTitle = titles[current];
			let currentProgress = `Exporting Title ${current + 1} out of ${max} (${
				localTitle.name || `#${localTitle.services[ActivableKey.MangaUpdates]!.id}`
			})...`;
			if (average > 0) currentProgress += `\nEstimated time remaining: ${duration((max - current) * average)}.`;
			progress.textContent = currentProgress;
			const before = Date.now();
			let failed = false;
			const title = new MangaUpdatesTitle({ ...localTitle, key: localTitle.services[ActivableKey.MangaUpdates] });
			if (title.status !== Status.NONE) {
				// Set current progress for the Title if there is one
				const onlineTitle = this.onlineList[title.key.id!];
				if (onlineTitle && onlineTitle.progress && onlineTitle.status) {
					title.current = {
						progress: onlineTitle.progress,
						status: onlineTitle.status,
						score: onlineTitle.score,
					};
				}
				const response = await title.persist();
				if (average == 0) average = Date.now() - before;
				else average = (average + (Date.now() - before)) / 2;
				if (response <= ResponseStatus.CREATED) this.summary.valid++;
				else failed = true;
			} else failed = true;
			if (failed) this.summary.failed.push(localTitle);
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
	}
}

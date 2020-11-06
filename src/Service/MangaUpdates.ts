import { DOM } from '../Core/DOM';
import { duration, ExportModule, ImportModule } from '../Core/Module';
import { ModuleInterface } from '../Core/ModuleInterface';
import { Runtime } from '../Core/Runtime';
import { ActivableKey, ActivableName, LoginMethod, Service } from '../Core/Service';
import { MissableField, ExternalTitle, FoundTitle, LocalTitle } from '../Core/Title';

export const enum MangaUpdatesStatus {
	NONE = -1,
	READING = 0,
	PLAN_TO_READ = 1,
	COMPLETED = 2,
	DROPPED = 3,
	PAUSED = 4,
}

export class MangaUpdatesImport extends ImportModule {
	static lists: string[] = ['read', 'wish', 'complete', 'unfinished', 'hold'];

	progressFromNode = (node: HTMLElement | null): number => {
		if (node !== null) {
			return parseInt((node.textContent as string).slice(2));
		}
		return 0;
	};

	execute = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Fetching all titles...' });
		const message = this.interface?.message('loading', [progress]);
		const parser = new DOMParser();

		// Get each pages
		let max = MangaUpdatesImport.lists.length;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const page = MangaUpdatesImport.lists[current];
			progress.textContent = `Fetching all titles... Page ${current + 1} out of ${max}.`;
			const response = await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/mylist.html?list=${page}`,
				credentials: 'include',
			});
			if (response.ok && response.body.indexOf('You must be a user to access this page.') < 0) {
				const body = parser.parseFromString(response.body, 'text/html');
				const rows = body.querySelectorAll(`div[id^='r']`);
				const status = MangaUpdatesTitle.listToStatus(page);
				for (const row of rows) {
					const scoreLink = row.querySelector(`a[title='Update Rating']`);
					let score: number | undefined;
					if (scoreLink !== null) {
						score = parseInt(scoreLink.textContent as string) * 10;
						if (isNaN(score)) score = undefined;
					}
					const name = row.querySelector(`a[title='Series Info']`) as HTMLElement;
					// No Max Chapter in lists
					this.found.push({
						key: { id: parseInt(row.id.slice(1)) },
						progress: {
							chapter: this.progressFromNode(row.querySelector(`a[title='Increment Chapter']`)),
							volume: this.progressFromNode(row.querySelector(`a[title='Increment Volume']`)),
						},
						status: MangaUpdatesTitle.toStatus(status),
						score: score,
						name: name.textContent as string,
						mochi: parseInt(row.id.slice(1)),
					});
				}
			}
		}
		message?.classList.remove('loading');

		return this.interface ? !this.interface.doStop : true;
	};
}

export class MangaUpdatesExport extends ExportModule {
	onlineList: { [key: string]: FoundTitle | undefined } = {};

	// We need the status of each titles before to move them from lists to lists
	// Use ImportModule and get a list of FoundTitle
	preExecute = async (titles: LocalTitle[]): Promise<boolean> => {
		const importModule = new MangaUpdatesImport(MangaUpdates);
		importModule.options.save.default = false;
		await importModule.run();
		this.onlineList = {};
		for (const title of importModule.found) {
			this.onlineList[title.key.id!] = title;
		}
		return true;
	};

	execute = async (titles: LocalTitle[]): Promise<boolean> => {
		const max = titles.length;
		this.interface?.message('default', `Exporting ${max} Titles...`);
		const progress = DOM.create('p');
		const message = this.interface?.message('loading', [progress]);
		let average = 0;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const localTitle = titles[current];
			let currentProgress = `Exporting Title ${current} out of ${max} (${localTitle.name})...`;
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
				if (response <= RequestStatus.CREATED) this.summary.valid++;
				else failed = true;
			} else failed = true;
			if (failed) this.summary.failed.push(localTitle);
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
	};
}

export class MangaUpdates extends Service {
	static readonly serviceName: ActivableName = ActivableName.MangaUpdates;
	static readonly key: ActivableKey = ActivableKey.MangaUpdates;

	static loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	static loginUrl: string = 'https://www.mangaupdates.com/login.html';

	static importModule = (moduleInterface?: ModuleInterface) => new MangaUpdatesImport(MangaUpdates, moduleInterface);
	static exportModule = (moduleInterface?: ModuleInterface) => new MangaUpdatesExport(MangaUpdates, moduleInterface);

	static loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.body && response.body.indexOf(`You are currently logged in as`) >= 0) return RequestStatus.SUCCESS;
		return RequestStatus.FAIL;
	};

	static link(key: MediaKey): string {
		return `https://www.mangaupdates.com/series.html?id=${key.id}`;
	}
}

export class MangaUpdatesTitle extends ExternalTitle {
	static service = MangaUpdates;
	static readonly missingFields: MissableField[] = ['start', 'end'];

	current: {
		progress: Progress;
		status: Status;
		score?: number;
	} = { progress: { chapter: 0 }, status: Status.NONE };

	static listToStatus = (list?: string): MangaUpdatesStatus => {
		if (!list) return MangaUpdatesStatus.READING;
		switch (list) {
			case 'read':
				return MangaUpdatesStatus.READING;
			case 'wish':
				return MangaUpdatesStatus.PLAN_TO_READ;
			case 'complete':
				return MangaUpdatesStatus.COMPLETED;
			case 'unfinished':
				return MangaUpdatesStatus.DROPPED;
			case 'hold':
				return MangaUpdatesStatus.PAUSED;
		}
		return MangaUpdatesStatus.NONE;
	};

	static get = async (key: MediaKey): Promise<ExternalTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: MangaUpdatesTitle.link(key),
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const values: Partial<MangaUpdatesTitle> = { progress: { chapter: 0 }, key: key };
		values.current = { progress: { chapter: 0 }, status: Status.NONE };
		const showList = body.getElementById('showList');
		if (showList !== null) {
			values.loggedIn = true;
			// No maximum chapter/volume on MangaUpdates...
			const listType = /mylist\.html(?:\?list=(.+))?/.exec(showList.querySelector<HTMLAnchorElement>('a')!.href);
			if (listType !== null) {
				values.inList = true;
				values.status = MangaUpdatesTitle.toStatus(MangaUpdatesTitle.listToStatus(listType[1]));
				// The state in list is only displayed if the title is in the READING list
				if (values.status == Status.READING) {
					const chapterLink = showList.querySelector<HTMLAnchorElement>(`a[title='Increment Chapter']`)!;
					const volumeLink = showList.querySelector<HTMLAnchorElement>(`a[title='Increment Volume']`)!;
					// Remove c. and v. with substr
					values.progress = { chapter: parseInt(chapterLink.textContent!.substr(2)) };
					const volume = parseInt(volumeLink.textContent!.substr(2));
					if (volume > 1) values.progress.volume = volume;
					values.current.progress = Object.assign({}, values.progress); // Avoid reference
				}
			} else values.inList = false;
			// We only get the rating if it's in the list - even if it's not required
			const scoreNode = body.querySelector<HTMLInputElement>(`input[type='radio'][name='rating'][checked]`);
			if (scoreNode) {
				// MangaUpdates have a simple 0-10 range
				values.score = parseInt(scoreNode.value) * 10;
				values.current.score = values.score;
			}
		} else values.loggedIn = false;
		const title = body.querySelector('span.releasestitle');
		values.name = title ? title.textContent! : undefined;
		return new MangaUpdatesTitle(values);
	};

	// Get a list of status to go through to be able to update to the wanted status
	pathToStatus = (): MangaUpdatesStatus[] => {
		let list: MangaUpdatesStatus[] = [];
		const newEntry = !this.inList;
		const from = newEntry ? MangaUpdatesStatus.NONE : MangaUpdatesTitle.fromStatus(this.current!.status);
		const to = MangaUpdatesTitle.fromStatus(this.status);
		// PAUSED requirements
		if (to == MangaUpdatesStatus.PAUSED) {
			if (newEntry) {
				list.push(MangaUpdatesStatus.READING);
			} else if (from != MangaUpdatesStatus.READING && from != MangaUpdatesStatus.DROPPED) {
				list.push(MangaUpdatesStatus.READING);
			}
			// DROPPED requirements
		} else if (to == MangaUpdatesStatus.DROPPED) {
			if (newEntry) {
				list.push(MangaUpdatesStatus.READING);
			} else if (from != MangaUpdatesStatus.PAUSED) {
				if (from != MangaUpdatesStatus.READING) {
					list.push(MangaUpdatesStatus.READING);
				}
				list.push(MangaUpdatesStatus.PAUSED);
			}
			// PLAN TO READ requirements
		} else if (to == MangaUpdatesStatus.PLAN_TO_READ) {
			if (!newEntry) {
				list.push(MangaUpdatesStatus.NONE);
			}
			// COMPLETED requirements
		} else if (to == MangaUpdatesStatus.COMPLETED) {
			if (!newEntry && from != MangaUpdatesStatus.READING) {
				list.push(MangaUpdatesStatus.READING);
			}
		}
		return list;
	};

	updateStatus = async (status: MangaUpdatesStatus): Promise<RawResponse> => {
		return await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/ajax/list_update.php?s=${this.key.id}&l=${status}`,
			method: 'GET',
			credentials: 'include',
		});
	};

	persist = async (): Promise<RequestStatus> => {
		// Avoid updating status since reassigning the same status delete from the list
		if (this.status !== this.current.status) {
			// Status requirements
			let list = this.pathToStatus();
			for (const status of list) {
				if (status == MangaUpdatesStatus.NONE) {
					this.delete();
				} else {
					const response = await this.updateStatus(status);
					if (!response.ok) return Runtime.responseStatus(response);
				}
			}
			// Real status
			const response = await this.updateStatus(MangaUpdatesTitle.fromStatus(this.status));
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.status = this.status;
		}
		// Update progress -- only if chapter or volume is different
		if (
			(this.progress.chapter > 1 && this.progress.chapter != this.current.progress.chapter) ||
			(this.progress.volume !== undefined &&
				this.progress.volume > 0 &&
				this.progress.volume != this.current.progress.volume)
		) {
			const volume =
				this.progress.volume !== undefined && this.progress.volume > 0 ? `&set_v=${this.progress.volume}` : '';
			const response = await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/chap_update.php?s=${this.key.id}${volume}&set_c=${Math.floor(
					this.progress.chapter
				)}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.progress = {
				chapter: this.progress.chapter,
				volume: this.progress.volume,
			};
		}
		// Update score
		if (
			this.score > 0 &&
			(this.current.score === undefined || (this.score != this.current.score && this.score > 0))
		) {
			// Convert back to the MangaUpdates 0-10 range
			const muScore = Math.round(this.score / 10);
			const response = await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/update_rating.php?s=${this.key.id}&r=${muScore}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.score = this.score;
		}
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/ajax/list_update.php?s=${this.key.id}&r=1`,
			credentials: 'include',
		});
		this.inList = false;
		const status = Runtime.responseStatus(response);
		return status == RequestStatus.SUCCESS ? RequestStatus.DELETED : status;
	};

	static toStatus = (status: MangaUpdatesStatus): Status => {
		switch (status) {
			case MangaUpdatesStatus.NONE:
				return Status.NONE;
			case MangaUpdatesStatus.READING:
				return Status.READING;
			case MangaUpdatesStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
			case MangaUpdatesStatus.COMPLETED:
				return Status.COMPLETED;
			case MangaUpdatesStatus.DROPPED:
				return Status.DROPPED;
			case MangaUpdatesStatus.PAUSED:
				return Status.PAUSED;
		}
	};

	static fromStatus = (status: Status): MangaUpdatesStatus => {
		switch (status) {
			case Status.READING:
				return MangaUpdatesStatus.READING;
			case Status.PLAN_TO_READ:
				return MangaUpdatesStatus.PLAN_TO_READ;
			case Status.COMPLETED:
				return MangaUpdatesStatus.COMPLETED;
			case Status.DROPPED:
				return MangaUpdatesStatus.DROPPED;
			case Status.PAUSED:
				return MangaUpdatesStatus.PAUSED;
		}
		return MangaUpdatesStatus.NONE;
	};

	static idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?mangaupdates\.com\/series.html\?id=(\d+)/.exec(href);
		if (regexp !== null) return { id: parseInt(regexp[1]) };
		return { id: 0 };
	};

	static idFromString = (str: string): MediaKey => {
		return { id: parseInt(str) };
	};

	get mochi(): number {
		return this.key.id!;
	}
}

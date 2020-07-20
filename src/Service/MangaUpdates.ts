import { Runtime, RequestStatus } from '../Runtime';
import { ServiceTitle, Title, ServiceKeyType, ActivableName, ActivableKey, MissableField } from '../Title';

export const enum MangaUpdatesStatus {
	NONE = -1,
	READING = 0,
	PLAN_TO_READ = 1,
	COMPLETED = 2,
	DROPPED = 3,
	PAUSED = 4,
}

export class MangaUpdatesTitle extends ServiceTitle {
	static readonly serviceName: ActivableName = ActivableName.MangaUpdates;
	static readonly serviceKey: ActivableKey = ActivableKey.MangaUpdates;
	static readonly missingFields: MissableField[] = ['start', 'end'];

	static link(id: ServiceKeyType): string {
		return `https://www.mangaupdates.com/series.html?id=${id}`;
	}

	id: number;
	current?: {
		progress: Progress;
		status: Status;
		score?: number;
	};

	constructor(id: number, title?: Partial<MangaUpdatesTitle>) {
		super(title);
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : Status.NONE;
	}

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

	static get = async (id: ServiceKeyType): Promise<ServiceTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: MangaUpdatesTitle.link(id),
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const values: Partial<MangaUpdatesTitle> = { progress: { chapter: 0 } };
		const showList = body.getElementById('showList');
		if (showList !== null) {
			values.loggedIn = true;
			const listType = /mylist\.html(?:\?list=(.+))?/.exec(showList.querySelector<HTMLAnchorElement>('a')!.href);
			if (listType !== null) {
				values.inList = true;
				values.status = MangaUpdatesTitle.toStatus(MangaUpdatesTitle.listToStatus(listType[1]));
				values.current = { progress: { chapter: 0 }, status: values.status };
				// The state in list is only displayed if the title is in the READING list
				if (values.status == Status.READING) {
					const chapter = showList.querySelector<HTMLAnchorElement>(`a[title='Increment Chapter']`)!;
					const volume = showList.querySelector<HTMLAnchorElement>(`a[title='Increment Volume']`)!;
					values.progress = {
						chapter: parseInt(chapter.textContent!.substr(2)), // Remove c. and v.
						volume: parseInt(volume.textContent!.substr(2)),
					};
					values.current.progress = Object.assign({}, values.progress); // Avoid reference
				}
			} else values.inList = false;
			// We only get the rating if it's in the list - even if it's not required
			const scoreNode = body.querySelector<HTMLInputElement>(`input[type='radio'][name='rating'][checked]`);
			if (scoreNode) {
				// MangaUpdates have a simple 0-10 range
				values.score = parseInt(scoreNode.value) * 10;
				if (values.current) values.current.score = values.score;
			}
		} else values.loggedIn = false;
		const title = body.querySelector('span.releasestitle');
		values.name = title ? title.textContent! : undefined;
		return new MangaUpdatesTitle(id as number, values);
	};

	// Get a list of status to go through to be able to update to the wanted status
	pathToStatus = (): MangaUpdatesStatus[] => {
		let list: MangaUpdatesStatus[] = [];
		const newEntry = this.current === undefined;
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
			url: `https://www.mangaupdates.com/ajax/list_update.php?s=${this.id}&l=${status}`,
			method: 'GET',
			credentials: 'include',
		});
	};

	persist = async (): Promise<RequestStatus> => {
		// Avoid updating status since reassigning the same status delete from the list
		if (this.current === undefined || this.status !== this.current.status) {
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
		}
		// Update progress -- only if chapter or volume is different
		if (
			this.current === undefined ||
			(this.progress.chapter > 1 && this.progress.chapter != this.current.progress.chapter) ||
			(this.progress.volume !== undefined &&
				this.progress.volume > 0 &&
				this.progress.volume != this.current.progress.volume)
		) {
			const volume =
				this.progress.volume !== undefined && this.progress.volume > 0 ? `&set_v=${this.progress.volume}` : '';
			const response = await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/chap_update.php?s=${this.id}${volume}&set_c=${this.progress.chapter}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
		}
		// Update score
		if (
			this.score !== undefined &&
			this.score > 0 &&
			(this.current === undefined ||
				this.current.score === undefined ||
				(this.score != this.current.score && this.current.score > 0))
		) {
			// Convert back to the MangaUpdates 0-10 range
			const muScore = Math.round(this.score / 10);
			const response = await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/update_rating.php?s=${this.id}&r=${muScore}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
		}
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/ajax/list_update.php?s=${this.id}&r=1`,
			credentials: 'include',
		});
		this.inList = false;
		return Runtime.responseStatus(response);
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

	static fromTitle = (title: Title): MangaUpdatesTitle | undefined => {
		if (!title.services.mu) return undefined;
		return new MangaUpdatesTitle(title.services.mu, {
			progress: title.progress,
			status: title.status,
			score: title.score ? title.score : undefined,
			name: title.name,
		});
	};

	static idFromLink = (href: string): number => {
		const regexp = /https:\/\/(?:www\.)?mangaupdates\.com\/series.html\?id=(\d+)/.exec(href);
		if (regexp !== null) return parseInt(regexp[1]);
		return 0;
	};

	get mochi(): number {
		return this.id;
	}
}

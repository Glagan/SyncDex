import { Runtime, RequestStatus } from '../Runtime';
import { ServiceTitle, Title } from '../Title';
import { Progress, ServiceKey, ServiceName, Status } from '../core';

export const enum MangaUpdatesStatus {
	NONE = -1,
	READING = 0,
	PLAN_TO_READ = 1,
	COMPLETED = 2,
	DROPPED = 3,
	PAUSED = 4,
}

export class MangaUpdatesTitle extends ServiceTitle<MangaUpdatesTitle> {
	readonly serviceKey: ServiceKey = ServiceKey.MangaUpdates;
	readonly serviceName: ServiceName = ServiceName.MangaUpdates;

	status: MangaUpdatesStatus = MangaUpdatesStatus.NONE;
	current?: {
		progress: Progress;
		status: MangaUpdatesStatus;
		score?: number;
	};

	static listToStatus = (list: string): MangaUpdatesStatus => {
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

	static get = async <T extends ServiceTitle<T> = MangaUpdatesTitle>(
		id: number | string
	): Promise<MangaUpdatesTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/series.html?id=${id}`,
			method: 'GET',
			credentials: 'include',
		});
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const values: Partial<MangaUpdatesTitle> = {};
		const showList = body.getElementById('showList');
		if (showList !== null) {
			const listType = /mylist\.html(?:\?list=(.+))?/.exec(
				(showList.querySelector('a') as HTMLAnchorElement).href
			);
			if (listType !== null) {
				values.status = MangaUpdatesTitle.listToStatus(listType[1]);
				values.current = { progress: { chapter: 0 }, status: values.status };
				// The state in list is only displayed if the title is in the READING list
				if (values.status == MangaUpdatesStatus.READING) {
					const chapter = showList.querySelector(`a[title='Increment Chapter']`) as HTMLAnchorElement;
					const volume = showList.querySelector(`a[title='Increment Volume']`) as HTMLAnchorElement;
					values.progress = {
						chapter: parseInt((chapter.textContent as string).substr(2)), // Remove c. and v.
						volume: parseInt((volume.textContent as string).substr(2)),
					};
					values.current.progress = Object.assign({}, values.progress); // Avoid reference
				}
			}
			// We only get the rating if it's in the list - even if it's not required
			const scoreNode = body.querySelector<HTMLInputElement>(`input[type='radio'][name='rating'][checked]`);
			if (scoreNode) {
				values.score = parseInt(scoreNode.value);
				if (values.current) values.current.score = values.score;
			}
		}
		const title = body.querySelector('span.releasestitle');
		values.name = title ? (title.textContent as string) : undefined;
		return new MangaUpdatesTitle(id, values);
	};

	// Get a list of status to go through to be able to update to the wanted status
	pathToStatus = (): MangaUpdatesStatus[] => {
		let list: MangaUpdatesStatus[] = [];
		const newEntry = this.current === undefined;
		const from = newEntry ? MangaUpdatesStatus.NONE : this.current?.status;
		const to = this.status;
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
		// Status requirements
		const newEntry = this.current === undefined;
		let list = this.pathToStatus();
		for (const status of list) {
			if (status == MangaUpdatesStatus.NONE) {
				this.delete();
			} else await this.updateStatus(status);
		}
		// Real status
		await this.updateStatus(this.status);
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
			await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/chap_update.php?s=${this.id}${volume}&set_c=${this.progress.chapter}`,
				credentials: 'include',
			});
		}
		// Update score
		if (
			(this.current === undefined && this.score !== undefined && this.score > 0) ||
			(this.current !== undefined &&
				this.current.score !== undefined &&
				this.score != this.current.score &&
				this.current.score > 0)
		) {
			await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/update_rating.php?s=${this.id}&r=${this.score}`,
				credentials: 'include',
			});
		}
		if (newEntry) return RequestStatus.CREATED;
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/ajax/list_update.php?s=${this.id}&r=1`,
			credentials: 'include',
		});
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		return RequestStatus.SUCCESS;
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

	toTitle = (): Title | undefined => {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { mu: this.id as number },
			progress: this.progress,
			status: MangaUpdatesTitle.toStatus(this.status),
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			name: this.name,
		});
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

	static fromTitle = <T extends ServiceTitle<T> = MangaUpdatesTitle>(title: Title): MangaUpdatesTitle | undefined => {
		if (!title.services.mu) return undefined;
		return new MangaUpdatesTitle(title.services.mu, {
			progress: title.progress,
			status: MangaUpdatesTitle.fromStatus(title.status),
			score: title.score ? title.score : undefined,
			name: title.name,
		});
	};
}

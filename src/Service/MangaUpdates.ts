import { Runtime, RawResponse, RequestStatus } from '../Runtime';
import { ServiceTitle, Title } from '../Title';
import { Progress, ServiceKey, ServiceName, Status } from '../core';
import { MangaUpdates } from '../../options/Service/MangaUpdates';

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

	static get = async <T extends ServiceTitle<T> = MangaUpdatesTitle>(
		id: number | string
	): Promise<MangaUpdatesTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/series.html?id=${id}`,
			method: 'GET',
			credentials: 'include',
		});
		// TODO
		return new MangaUpdatesTitle(id);
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

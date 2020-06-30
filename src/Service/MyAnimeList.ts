import { RequestStatus } from '../Runtime';
import { ServiceTitle, Title } from '../Title';
import { ServiceKey, ServiceName, Status } from '../core';

export enum MyAnimeListStatus {
	NONE = 0,
	READING = 1,
	COMPLETED = 2,
	PAUSED = 3,
	DROPPED = 4,
	PLAN_TO_READ = 6,
}

export class MyAnimeListTitle extends ServiceTitle<MyAnimeListTitle> {
	readonly serviceKey: ServiceKey = ServiceKey.MyAnimeList;
	readonly serviceName: ServiceName = ServiceName.MyAnimeList;

	status: MyAnimeListStatus = MyAnimeListStatus.NONE;
	// TODO: csrf Token
	csrtf: string = '';

	static get = async <T extends ServiceTitle<T> = MyAnimeListTitle>(
		id: string | number
	): Promise<MyAnimeListTitle | RequestStatus> => {
		// TODO
		return RequestStatus.SUCCESS;
	};

	persist = async (): Promise<RequestStatus> => {
		// TODO
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		// TODO
		return RequestStatus.SUCCESS;
	};

	// Convert a YYYY-MM-DD MyAnimeList date to a Date timestamp
	dateToTime = (date?: string): number | undefined => {
		if (date === undefined) return undefined;
		const d = new Date(date);
		if (isNaN(d.getFullYear()) || d.getFullYear() === 0) return undefined;
		return d.getTime();
	};

	static toStatus = (status: MyAnimeListStatus): Status => {
		switch (status) {
			case MyAnimeListStatus.NONE:
				return Status.NONE;
			case MyAnimeListStatus.READING:
				return Status.READING;
			case MyAnimeListStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
			case MyAnimeListStatus.COMPLETED:
				return Status.COMPLETED;
			case MyAnimeListStatus.DROPPED:
				return Status.DROPPED;
			case MyAnimeListStatus.PAUSED:
				return Status.PAUSED;
		}
	};

	toTitle = (): Title | undefined => {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { mal: this.id as number },
			progress: this.progress,
			status: MyAnimeListTitle.toStatus(this.status),
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			start: this.start ? this.start.getTime() : undefined,
			end: this.end ? this.end.getTime() : undefined,
			name: this.name,
		});
	};

	static fromStatus = (status: Status): MyAnimeListStatus => {
		switch (status) {
			case Status.READING:
				return MyAnimeListStatus.READING;
			case Status.COMPLETED:
				return MyAnimeListStatus.COMPLETED;
			case Status.PAUSED:
				return MyAnimeListStatus.PAUSED;
			case Status.DROPPED:
				return MyAnimeListStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return MyAnimeListStatus.PLAN_TO_READ;
		}
		return MyAnimeListStatus.NONE;
	};

	static fromTitle = <T extends ServiceTitle<T> = MyAnimeListTitle>(title: Title): MyAnimeListTitle | undefined => {
		if (!title.services.ap) return undefined;
		return new MyAnimeListTitle(title.services.ap, {
			progress: title.progress,
			status: MyAnimeListTitle.fromStatus(title.status),
			score: title.score ? title.score : undefined,
			start: title.start ? new Date(title.start) : undefined,
			end: title.end ? new Date(title.end) : undefined,
			name: title.name,
		});
	};
}

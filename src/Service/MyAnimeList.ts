import { Service, Status, ServiceName, ServiceKey } from '../Service';
import { Runtime, RawResponse, RequestStatus } from '../Runtime';
import { ServiceTitle, Title } from '../Title';
import { Progress } from '../interfaces';

export enum MyAnimeListStatus {
	NONE = 0,
	READING = 1,
	COMPLETED = 2,
	PAUSED = 3,
	DROPPED = 4,
	PLAN_TO_READ = 6,
}

export class MyAnimeList extends Service {
	key: ServiceKey = ServiceKey.MyAnimeList;
	name: ServiceName = ServiceName.MyAnimeList;

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://myanimelist.net/login.php',
			method: 'GET',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return RequestStatus.BAD_REQUEST;
		}
		if (response.ok && response.body && response.url.indexOf('login.php') < 0) {
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
	};
}

export class MyAnimeListTitle extends ServiceTitle {
	id: number;
	mangaDex?: number;

	progress: Progress = {
		chapter: 0,
	};
	status: MyAnimeListStatus = MyAnimeListStatus.NONE;
	start?: string;
	end?: string;
	score?: number;
	name?: string;

	constructor(id: number, title?: Partial<MyAnimeListTitle>) {
		super();
		this.id = id;
		if (title !== undefined) {
			Object.assign(this, title);
		}
	}

	static get = async (id: string | number): Promise<RequestStatus> => {
		return RequestStatus.SUCCESS;
	};

	persist = async (): Promise<RequestStatus> => {
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		return RequestStatus.SUCCESS;
	};

	toStatus = (): Status => {
		switch (this.status) {
			case MyAnimeListStatus.NONE:
				return Status.NONE;
			case MyAnimeListStatus.READING:
				return Status.READING;
			case MyAnimeListStatus.COMPLETED:
				return Status.COMPLETED;
			case MyAnimeListStatus.PAUSED:
				return Status.PAUSED;
			case MyAnimeListStatus.DROPPED:
				return Status.DROPPED;
			case MyAnimeListStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
		}
	};

	// Convert a YYYY-MM-DD MyAnimeList date to a Date timestamp
	dateToTime = (date?: string): number | undefined => {
		if (date === undefined) return undefined;
		const d = new Date(date);
		if (isNaN(d.getFullYear()) || d.getFullYear() === 0) return undefined;
		return d.getTime();
	};

	title = (): Title | undefined => {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { mal: this.id },
			progress: this.progress,
			status: this.toStatus(),
			// TODO: Score conversion
			score: this.score && this.score > 0 ? this.score : undefined,
			start: this.dateToTime(this.start),
			end: this.dateToTime(this.end),
			name: this.name,
		});
	};
}

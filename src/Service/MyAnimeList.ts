import { RequestStatus, Runtime } from '../Runtime';
import { ServiceTitle, Title, ServiceKey, ServiceName } from '../Title';

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

	status: MyAnimeListStatus;
	newEntry: boolean;
	csrf: string;

	constructor(id: number | string, title?: Partial<MyAnimeListTitle>) {
		super(id, title);
		this.status = title && title.status !== undefined ? title.status : MyAnimeListStatus.NONE;
		this.csrf = title && title.csrf !== undefined ? title.csrf : '';
		this.newEntry = title && title.newEntry !== undefined ? title.newEntry : false;
	}

	static dateRowToDate = (body: Document, row: 'start' | 'finish'): Date | undefined => {
		const year = body.getElementById(`add_manga_${row}_date_year`),
			month = body.getElementById(`add_manga_${row}_date_month`),
			day = body.getElementById(`add_manga_${row}_date_day`);
		if (month == null || day == null || year == null) return undefined;
		return new Date(
			parseInt((year as HTMLSelectElement).value),
			parseInt((month as HTMLSelectElement).value),
			parseInt((day as HTMLSelectElement).value)
		);
	};

	static get = async <T extends ServiceTitle<T> = MyAnimeListTitle>(
		id: string | number
	): Promise<MyAnimeListTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/ownlist/manga/${id}/edit?hideLayout`,
			method: 'GET',
			cache: 'no-cache',
			credentials: 'include',
			redirect: 'follow',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		const values: Partial<MyAnimeListTitle> = {};
		const csrf = /'csrf_token'\scontent='(.{40})'/.exec(response.body);
		if (csrf !== null) values.csrf = csrf[1];
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const title = body.querySelector<HTMLElement>(`a[href^='/manga/']`);
		if (!response.redirected) {
			if (title !== null) {
				values.name = title.textContent as string;
				values.status = parseInt((body.getElementById('add_manga_status') as HTMLSelectElement).value);
				values.progress = {
					chapter:
						parseInt((body.getElementById('add_manga_num_read_chapters') as HTMLInputElement).value) || 0,
					volume:
						parseInt((body.getElementById('add_manga_num_read_volumes') as HTMLInputElement).value) || 0,
				};
				const score = (body.getElementById('add_manga_score') as HTMLSelectElement).value;
				if (score !== '') values.score = parseInt(score);
				values.start = MyAnimeListTitle.dateRowToDate(body, 'start');
				values.end = MyAnimeListTitle.dateRowToDate(body, 'finish');
			}
		}
		values.newEntry = response.redirected && title !== null;
		return new MyAnimeListTitle(id, values);
	};

	persist = async (): Promise<RequestStatus> => {
		let url = `https://myanimelist.net/ownlist/manga/${this.id}/edit?hideLayout`;
		if (this.newEntry) url = `https://myanimelist.net/ownlist/manga/add?selected_manga_id=${this.id}&hideLayout`;
		const body: FormDataProxy = {
			manga_id: this.id,
			'add_manga[status]': this.status,
			'add_manga[num_read_chapters]': this.progress.chapter,
			csrf_token: this.csrf,
		};
		if (this.progress.volume) body['add_manga[num_read_volumes]'] = this.progress.volume;
		if (this.score) body['add_manga[score]'] = this.score;
		if (this.start) {
			body['add_manga[start_date][yeay]'] = this.start.getUTCFullYear();
			body['add_manga[start_date][month]'] = this.start.getMonth() + 1;
			body['add_manga[start_date][day]'] = this.start.getDate();
		}
		if (this.end) {
			body['add_manga[finish_date][yeay]'] = this.end.getUTCFullYear();
			body['add_manga[finish_date][month]'] = this.end.getMonth() + 1;
			body['add_manga[finish_date][day]'] = this.end.getDate();
		}
		const response = await Runtime.request<RawResponse>({
			url: url,
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body,
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (this.newEntry) {
			this.newEntry = false;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/ownlist/manga/${this.id}delete`,
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `csrf_token=${this.csrf}`,
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.newEntry = true;
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

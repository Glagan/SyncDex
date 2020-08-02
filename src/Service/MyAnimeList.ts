import { RequestStatus, Runtime } from '../Runtime';
import { ServiceKeyType, ActivableName, ActivableKey, ExternalTitle } from '../Title';

export enum MyAnimeListStatus {
	NONE = 0,
	READING = 1,
	COMPLETED = 2,
	PAUSED = 3,
	DROPPED = 4,
	PLAN_TO_READ = 6,
}

export class MyAnimeListTitle extends ExternalTitle {
	static readonly serviceName: ActivableName = ActivableName.MyAnimeList;
	static readonly serviceKey: ActivableKey = ActivableKey.MyAnimeList;

	static link(id: ServiceKeyType): string {
		return `https://myanimelist.net/manga/${id}`;
	}

	id: number;
	csrf: string;

	constructor(id: ServiceKeyType, title?: Partial<MyAnimeListTitle>) {
		super(title);
		if (typeof id !== 'number') throw 'Anilist ID can only be a number';
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : Status.NONE;
		this.csrf = title && title.csrf !== undefined ? title.csrf : '';
	}

	static dateRowToDate = (body: Document, row: 'start' | 'finish'): Date | undefined => {
		const year = body.getElementById(`add_manga_${row}_date_year`) as HTMLSelectElement,
			month = body.getElementById(`add_manga_${row}_date_month`) as HTMLSelectElement,
			day = body.getElementById(`add_manga_${row}_date_day`) as HTMLSelectElement;
		if (month == null || day == null || year == null) return undefined;
		const parts: number[] = [parseInt(year.value), parseInt(month.value), parseInt(day.value)];
		if (parts.some((part) => isNaN(part))) return undefined;
		return new Date(parts[0], parts[1] - 1, parts[2]);
	};

	static get = async (id: ServiceKeyType): Promise<ExternalTitle | RequestStatus> => {
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
		if (csrf !== null) {
			values.csrf = csrf[1];
		}
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const title = body.querySelector<HTMLElement>(`a[href^='/manga/']`);
		if (!response.redirected) {
			values.loggedIn = true;
			if (title !== null) {
				values.inList = true;
				values.name = title.textContent!;
				values.status = MyAnimeListTitle.toStatus(
					parseInt((body.getElementById('add_manga_status') as HTMLSelectElement).value)
				);
				values.progress = {
					chapter:
						parseInt((body.getElementById('add_manga_num_read_chapters') as HTMLInputElement).value) || 0,
					volume:
						parseInt((body.getElementById('add_manga_num_read_volumes') as HTMLInputElement).value) ||
						undefined,
				};
				const score = (body.getElementById('add_manga_score') as HTMLSelectElement).value;
				if (score !== '') values.score = parseInt(score) * 10;
				values.start = MyAnimeListTitle.dateRowToDate(body, 'start');
				values.end = MyAnimeListTitle.dateRowToDate(body, 'finish');
			}
		} else {
			values.inList = false;
			if (/\/login\./.test(response.url)) {
				values.loggedIn = false;
			} else values.loggedIn = true;
		}
		return new MyAnimeListTitle(id as number, values);
	};

	persist = async (): Promise<RequestStatus> => {
		let url = `https://myanimelist.net/ownlist/manga/${this.id}/edit?hideLayout`;
		if (!this.inList) url = `https://myanimelist.net/ownlist/manga/add?selected_manga_id=${this.id}&hideLayout`;
		const body: Record<string, string | number> = {
			entry_id: 0,
			manga_id: this.id,
			'add_manga[status]': MyAnimeListTitle.fromStatus(this.status),
		};
		if (this.progress.volume) body['add_manga[num_read_volumes]'] = this.progress.volume;
		else body['add_manga[num_read_volumes]'] = 0;
		body['last_completed_vol'] = '';
		body['add_manga[num_read_chapters]'] = this.progress.chapter;
		// Score
		if (this.score) body['add_manga[score]'] = Math.round(this.score / 10);
		else body['add_manga[score]'] = '';
		// Dates
		if (this.start) {
			body['add_manga[start_date][month]'] = this.start.getMonth();
			body['add_manga[start_date][day]'] = this.start.getDate();
			body['add_manga[start_date][year]'] = this.start.getFullYear();
		} else {
			body['add_manga[start_date][month]'] = '';
			body['add_manga[start_date][day]'] = '';
			body['add_manga[start_date][year]'] = '';
		}
		if (this.end) {
			body['add_manga[finish_date][month]'] = this.end.getMonth();
			body['add_manga[finish_date][day]'] = this.end.getDate();
			body['add_manga[finish_date][year]'] = this.end.getFullYear();
		} else {
			body['add_manga[finish_date][month]'] = '';
			body['add_manga[finish_date][day]'] = '';
			body['add_manga[finish_date][year]'] = '';
		}
		// TODO: Retrieve all other fields
		body['add_manga[tags]'] = '';
		body['add_manga[priority]'] = 0;
		body['add_manga[storage_type]'] = '';
		body['add_manga[num_retail_volumes]'] = 0;
		body['add_manga[num_read_times]'] = 0;
		body['add_manga[reread_value]'] = '';
		body['add_manga[comments]'] = '';
		body['add_manga[is_asked_to_discuss]'] = 0;
		body['add_manga[sns_post_type]'] = 0;
		if (this.status == Status.REREADING) body['add_manga[is_rereading]'] = 1;
		body['submitIt'] = 0;
		body['csrf_token'] = this.csrf;
		const response = await Runtime.request<RawResponse>({
			url: url,
			method: 'POST',
			credentials: 'include',
			cache: 'no-cache',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: Object.keys(body)
				.map((field) => {
					return `${encodeURIComponent(field)}=${encodeURIComponent(body[field]!)}`;
				})
				.join('&'),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (!this.inList) {
			this.inList = true;
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
		this.inList = true;
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

	static idFromLink = (href: string): number => {
		const regexp = /https:\/\/(?:www\.)?myanimelist\.net\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return parseInt(regexp[1]);
		return 0;
	};

	static idFromString = (str: string): number => {
		return parseInt(str);
	};

	get mochi(): number {
		return this.id;
	}
}

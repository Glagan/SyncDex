import { log, LogExecTime } from '../../Core/Log';
import { Request } from '../../Core/Request';
import { LoginMethod, Service } from '../../Core/Service';
import { Title } from '../../Core/Title';
import { ActivableKey } from '../Keys';
import { ServiceName } from '../Names';

export enum MyAnimeListStatus {
	NONE = 0,
	READING = 1,
	COMPLETED = 2,
	PAUSED = 3,
	DROPPED = 4,
	PLAN_TO_READ = 6,
}

const GetField = <T extends HTMLElement>(parent: Document, field: string): T => {
	return parent.getElementById(field) as T;
};

export class MyAnimeList extends Service {
	name = ServiceName.MyAnimeList;
	key = ActivableKey.MyAnimeList;
	activable = true;

	loginMethod = LoginMethod.EXTERNAL;
	loginUrl = 'https://myanimelist.net/login.php';

	static username: string = '';

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Request.get<RawResponse>({
			url: 'https://myanimelist.net/about.php',
			method: 'GET',
			credentials: 'include',
			cache: 'no-cache',
		});
		if (!response.ok) return Request.status(response);
		if (response.body == '') return RequestStatus.SERVER_ERROR;
		const body = new DOMParser().parseFromString(response.body, 'text/html');
		const header = body.querySelector<HTMLElement>('a.header-profile-link');
		if (header) {
			MyAnimeList.username = header.textContent!.trim();
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
	};

	dateRowToDate = (body: Document, row: 'start' | 'finish'): Date | undefined => {
		const year = body.getElementById(`add_manga_${row}_date_year`) as HTMLSelectElement,
			month = body.getElementById(`add_manga_${row}_date_month`) as HTMLSelectElement,
			day = body.getElementById(`add_manga_${row}_date_day`) as HTMLSelectElement;
		if (month == null || day == null || year == null) return undefined;
		const parts: number[] = [parseInt(year.value), parseInt(month.value), parseInt(day.value)];
		if (parts.some((part) => isNaN(part))) return undefined;
		return new Date(parts[0], Math.max(0, parts[1] - 1), parts[2]);
	};

	@LogExecTime
	async get(key: MediaKey): Promise<Title | RequestStatus> {
		const response = await Request.get<RawResponse>({
			url: `https://myanimelist.net/ownlist/manga/${key.id}/edit?hideLayout`,
			method: 'GET',
			cache: 'no-cache',
			credentials: 'include',
			redirect: 'follow',
		});
		if (!response.ok) return Request.status(response);
		const values: Partial<MyAnimeListTitle> = { key: key, inList: false };
		// name='csrf_token' content='0011223344556677788900112233445566777889'>
		const csrf = /'csrf_token'\s*content='(.{40})'/.exec(response.body);
		if (csrf !== null) values.csrf = csrf[1];
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		if (!response.redirected) {
			values.loggedIn = csrf !== null;
			const title = body.querySelector<HTMLElement>(`a[href^='/manga/']`);
			if (title !== null) {
				values.inList = true;
				values.max = {
					chapter: parseInt(body.getElementById('totalChap')!.textContent!) || undefined,
					volume: parseInt(body.getElementById('totalVol')!.textContent!) || undefined,
				};
				values.name = title.textContent!;
				values.status = MyAnimeListTitle.toStatus(
					parseInt(GetField<HTMLSelectElement>(body, 'add_manga_status').value)
				);
				values.progress = {
					chapter: parseInt(GetField<HTMLInputElement>(body, 'add_manga_num_read_chapters').value) || 0,
					volume: parseInt(GetField<HTMLInputElement>(body, 'add_manga_num_read_volumes').value) || undefined,
				};
				const score = GetField<HTMLSelectElement>(body, 'add_manga_score').value;
				if (score !== '') values.score = parseInt(score) * 10;
				values.start = this.dateRowToDate(body, 'start');
				values.end = this.dateRowToDate(body, 'finish');
				// Additional fields
				values.additional = {
					tags: GetField<HTMLTextAreaElement>(body, 'add_manga_tags').value,
					priority: GetField<HTMLSelectElement>(body, 'add_manga_priority').value,
					comments: GetField<HTMLTextAreaElement>(body, 'add_manga_comments').value,
					storage: GetField<HTMLSelectElement>(body, 'add_manga_storage_type').value,
					retailVolumes: GetField<HTMLInputElement>(body, 'add_manga_num_retail_volumes').value,
					rereadCount: GetField<HTMLInputElement>(body, 'add_manga_num_read_times').value,
					rereadPriority: GetField<HTMLSelectElement>(body, 'add_manga_reread_value').value,
					askToDiscuss: GetField<HTMLSelectElement>(body, 'add_manga_is_asked_to_discuss').value,
					postToSns: GetField<HTMLSelectElement>(body, 'add_manga_sns_post_type').value,
				};
			}
		} else {
			values.inList = false;
			if (/\/login\./.test(response.url)) {
				values.loggedIn = false;
			} else values.loggedIn = true;
		}
		return new MyAnimeListTitle(values);
	}

	link(key: MediaKey): string {
		return `https://myanimelist.net/manga/${key.id}`;
	}

	idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?myanimelist\.net\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return { id: parseInt(regexp[1]) };
		return { id: 0 };
	};
}

export class MyAnimeListTitle extends Title {
	static service = new MyAnimeList();

	csrf?: string;
	additional: {
		tags: string;
		priority: string;
		storage: string;
		retailVolumes: string;
		rereadCount: string;
		rereadPriority: string;
		comments: string;
		askToDiscuss: string;
		postToSns: string;
	} = {
		tags: '',
		priority: '0',
		storage: '',
		retailVolumes: '0',
		rereadCount: '0',
		rereadPriority: '',
		comments: '',
		askToDiscuss: '0',
		postToSns: '0',
	};

	@LogExecTime
	async persist(): Promise<RequestStatus> {
		if (this.status === Status.NONE || !this.csrf) {
			await log(`Could not sync MyAnimeList: status ${this.status} csrf ${!!this.csrf}`);
			return RequestStatus.BAD_REQUEST;
		}
		let url = `https://myanimelist.net/ownlist/manga/${this.key.id}/edit?hideLayout`;
		if (!this.inList) url = `https://myanimelist.net/ownlist/manga/add?selected_manga_id=${this.key.id}&hideLayout`;
		const body: Record<string, string | number> = {
			entry_id: 0,
			manga_id: this.key.id!,
			'add_manga[status]': MyAnimeListTitle.fromStatus(this.status),
		};
		if (this.volume) body['add_manga[num_read_volumes]'] = this.volume;
		else body['add_manga[num_read_volumes]'] = '';
		body['last_completed_vol'] = '';
		body['add_manga[num_read_chapters]'] = Math.floor(this.chapter);
		// Score
		if (this.score) body['add_manga[score]'] = Math.round(this.score / 10);
		else body['add_manga[score]'] = '';
		// Dates
		if (this.start) {
			body['add_manga[start_date][month]'] = this.start.getMonth() + 1;
			body['add_manga[start_date][day]'] = this.start.getDate();
			body['add_manga[start_date][year]'] = this.start.getFullYear();
		} else {
			body['add_manga[start_date][month]'] = '';
			body['add_manga[start_date][day]'] = '';
			body['add_manga[start_date][year]'] = '';
		}
		if (this.end) {
			body['add_manga[finish_date][month]'] = this.end.getMonth() + 1;
			body['add_manga[finish_date][day]'] = this.end.getDate();
			body['add_manga[finish_date][year]'] = this.end.getFullYear();
		} else {
			body['add_manga[finish_date][month]'] = '';
			body['add_manga[finish_date][day]'] = '';
			body['add_manga[finish_date][year]'] = '';
		}
		// Add other fields -- nothing is modified
		body['add_manga[tags]'] = this.additional.tags;
		body['add_manga[priority]'] = this.additional.priority;
		body['add_manga[storage_type]'] = this.additional.storage;
		body['add_manga[num_retail_volumes]'] = this.additional.retailVolumes;
		body['add_manga[num_read_times]'] = this.additional.rereadCount;
		body['add_manga[reread_value]'] = this.additional.rereadPriority;
		body['add_manga[comments]'] = this.additional.comments;
		body['add_manga[is_asked_to_discuss]'] = this.additional.askToDiscuss;
		body['add_manga[sns_post_type]'] = this.additional.postToSns;
		if (this.status == Status.REREADING) body['add_manga[is_rereading]'] = 1;
		body['submitIt'] = 0;
		body['csrf_token'] = this.csrf;
		const response = await Request.get<RawResponse>({
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
		if (!response.ok) return Request.status(response);
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	}

	delete = async (): Promise<RequestStatus> => {
		if (!this.inList || !this.csrf) {
			await log(`Could not sync MyAnimeList: status ${this.status} csrf ${!!this.csrf}`);
			return RequestStatus.BAD_REQUEST;
		}
		const response = await Request.get<RawResponse>({
			url: `https://myanimelist.net/ownlist/manga/${this.key.id}/delete`,
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `csrf_token=${this.csrf}`,
		});
		if (!response.ok) return Request.status(response);
		this.reset();
		return RequestStatus.DELETED;
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
			case Status.REREADING:
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
		// Status.WONT_READ
		return MyAnimeListStatus.NONE;
	};
}

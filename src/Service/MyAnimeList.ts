import { DOM } from '../Core/DOM';
import { log } from '../Core/Log';
import { ExportModule, ImportModule } from '../Core/Module';
import { ModuleInterface } from '../Core/ModuleInterface';
import { Runtime } from '../Core/Runtime';
import { ActivableKey, ActivableName, LoginMethod, Service } from '../Core/Service';
import { ExternalTitle, FoundTitle, LocalTitle } from '../Core/Title';
import { dateFormatInput } from '../Core/Utility';

export enum MyAnimeListStatus {
	NONE = 0,
	READING = 1,
	COMPLETED = 2,
	PAUSED = 3,
	DROPPED = 4,
	PLAN_TO_READ = 6,
}

enum MyAnimeListExportStatus {
	COMPLETED = 'Completed',
	PLAN_TO_READ = 'Plan to Read',
	READING = 'Reading',
	PAUSED = 'On-Hold',
	DROPPED = 'Dropped',
	NONE = 'Invalid',
}

interface MyAnimeListAPITitle {
	id: number;
	status: MyAnimeListStatus;
	score: number;
	num_read_chapters: number;
	num_read_volumes: number;
	manga_title: string;
	manga_num_chapters: number;
	manga_num_volumes: number;
	manga_publishing_status: number;
	manga_id: number;
	start_date_string: string | null;
	finish_date_string: string | null;
}

const GetField = <T extends HTMLElement>(parent: Document, field: string): T => {
	return parent.getElementById(field) as T;
};

export class MyAnimeListImport extends ImportModule {
	static api = (username: string, offset: number) =>
		`https://myanimelist.net/mangalist/${username}/load.json?offset=${offset}&status=7`;

	toStatus = (status: MyAnimeListExportStatus): Status => {
		switch (status) {
			case MyAnimeListExportStatus.READING:
				return Status.READING;
			case MyAnimeListExportStatus.COMPLETED:
				return Status.COMPLETED;
			case MyAnimeListExportStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
			case MyAnimeListExportStatus.PAUSED:
				return Status.PAUSED;
			case MyAnimeListExportStatus.DROPPED:
				return Status.DROPPED;
		}
		return Status.NONE;
	};

	// Convert a DD-MM-YYYY MyAnimeList date to a Date timestamp
	dateToTime = (date?: string): Date | undefined => {
		if (date === undefined) return undefined;
		const parts = date.split('-').map((p) => parseInt(p));
		if (parts.length != 3) return undefined;
		const year = parts[2] > 25 ? 1900 + parts[2] : 2000 + parts[2];
		return new Date(year, Math.min(0, parts[1] - 1), parts[0]);
	};

	preExecute = async (): Promise<boolean> => {
		if (MyAnimeList.username == '') {
			this.interface?.message('error', 'No MyAnimeList username found, make sure you are logged in.');
			return false;
		}
		return true;
	};

	execute = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Fetching all titles...' });
		const message = this.interface?.message('loading', [progress]);

		// Get each pages
		let lastPage = false;
		let current = 1;
		while (!this.interface?.doStop && !lastPage) {
			progress.textContent = `Fetching all titles... Page ${current}.`;
			const response = await Runtime.jsonRequest<MyAnimeListAPITitle[]>({
				url: MyAnimeListImport.api(MyAnimeList.username, (current - 1) * 300),
			});
			if (!response.ok) {
				message?.classList.remove('loading');
				this.interface?.message(
					'warning',
					'The request failed, maybe MyAnimeList is having problems, retry later.'
				);
				return false;
			}

			const body = response.body;
			// Each row has a data-id field
			for (const title of body) {
				const found: FoundTitle = {
					key: { id: title.manga_id },
					progress: {
						chapter: title.num_read_chapters,
						volume: title.num_read_volumes === 0 ? undefined : title.num_read_volumes,
					},
					status: MyAnimeListTitle.toStatus(title.status),
					score: title.score * 10,
					start: this.dateToTime(title.start_date_string ?? undefined),
					end: this.dateToTime(title.finish_date_string ?? undefined),
					name: title.manga_title,
					mochi: title.manga_id,
				};
				// Find Max Chapter if the Title is Completed
				if (title.manga_publishing_status == 2) {
					found.max = {
						chapter: title.manga_num_chapters,
						volume: title.manga_num_volumes,
					};
				}
				this.found.push(found);
			}
			lastPage = body.length != 300;
			current++;
		}
		message?.classList.remove('loading');

		return this.interface ? !this.interface.doStop : true;
	};
}

export class MyAnimeListExport extends ExportModule {
	csrfToken: string = '';

	// Create an xml node of type <type> and a value of <value>
	node = (document: Document, type: string, value?: string | number): HTMLElement => {
		const node = document.createElement(type);
		if (value !== undefined) node.textContent = typeof value === 'number' ? value.toString() : value;
		return node;
	};

	fromStatus = (status: Status): MyAnimeListExportStatus => {
		switch (status) {
			case Status.COMPLETED:
				return MyAnimeListExportStatus.COMPLETED;
			case Status.PLAN_TO_READ:
				return MyAnimeListExportStatus.PLAN_TO_READ;
			case Status.READING:
				return MyAnimeListExportStatus.READING;
			case Status.PAUSED:
				return MyAnimeListExportStatus.PAUSED;
			case Status.DROPPED:
				return MyAnimeListExportStatus.DROPPED;
		}
		return MyAnimeListExportStatus.NONE;
	};

	createTitle = (document: Document, title: LocalTitle): HTMLElement => {
		const node = document.createElement('manga');
		DOM.append(
			node,
			this.node(document, 'manga_mangadb_id', title.services.mal?.id),
			this.node(document, 'my_status', this.fromStatus(title.status)),
			this.node(document, 'my_read_chapters', title.progress.chapter),
			this.node(document, 'update_on_import', 1)
		);
		// Conver back to the 0-10 range
		if (title.score > 0) node.appendChild(this.node(document, 'my_score', Math.round(title.score / 10)));
		if (title.progress.volume) node.appendChild(this.node(document, 'my_read_volumes', title.progress.volume));
		if (title.start) node.appendChild(this.node(document, 'my_start_date', dateFormatInput(title.start)));
		if (title.end) node.appendChild(this.node(document, 'my_finish_date', dateFormatInput(title.end)));
		return node;
	};

	generateBatch = async (titles: LocalTitle[]): Promise<string> => {
		const xmlDocument = document.implementation.createDocument('myanimelist', '', null);
		const main = xmlDocument.createElement('myanimelist');
		xmlDocument.appendChild(main);
		const myinfo = xmlDocument.createElement('myinfo');
		myinfo.appendChild(this.node(xmlDocument, 'user_export_type', 2));
		main.appendChild(myinfo);
		for (const title of titles) {
			main.appendChild(this.createTitle(xmlDocument, title));
		}
		return `<?xml version="1.0" encoding="UTF-8" ?>${new XMLSerializer().serializeToString(xmlDocument)}`;
	};

	preExecute = async (titles: LocalTitle[]): Promise<boolean> => {
		let response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/import.php`,
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) {
			this.interface?.message(
				'warning',
				'The request failed, maybe MyAnimeList is having problems, retry later.'
			);
			return false;
		}
		const csrfTokenArr = /'csrf_token'\scontent='(.{40})'/.exec(response.body);
		if (!csrfTokenArr || csrfTokenArr[1] == '') {
			this.interface?.message('error', 'Token not found before import, make sure you are logged in.');
			return false;
		}
		this.csrfToken = csrfTokenArr[1];
		return true;
	};

	execute = async (titles: LocalTitle[]): Promise<boolean> => {
		let message = this.interface?.message('loading', 'Generating export file...');
		const file = await this.generateBatch(titles);
		message?.classList.remove('loading');
		if (this.interface?.doStop) return false;

		// Send file
		message = this.interface?.message('loading', 'Sending export file...');
		const response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/import.php`,
			method: 'POST',
			credentials: 'include',
			form: {
				importtype: '3',
				subimport: 'Import Data',
				csrf_token: this.csrfToken,
				mal: {
					content: [file],
					name: 'mal_export.xml',
					options: {
						type: 'text/xml',
					},
				},
			},
		});
		message?.classList.remove('loading');
		if (!response.ok) return false;

		// Update summary with number of updated titles	if (response.code == 200) {
		const totalArr = /Total\s*Entries\s*Updated:\s*(\d+)/.exec(response.body);
		const totalUpdated = totalArr ? +totalArr[1] : 0;
		this.summary.valid = totalUpdated;

		return true;
	};
}

export class MyAnimeList extends Service {
	static readonly serviceName: ActivableName = ActivableName.MyAnimeList;
	static readonly key: ActivableKey = ActivableKey.MyAnimeList;

	static loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	static loginUrl: string = 'https://myanimelist.net/login.php';

	static importModule = (moduleInterface?: ModuleInterface) => new MyAnimeListImport(MyAnimeList, moduleInterface);
	static exportModule = (moduleInterface?: ModuleInterface) => new MyAnimeListExport(MyAnimeList, moduleInterface);

	static username: string = '';

	static loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://myanimelist.net/about.php',
			method: 'GET',
			credentials: 'include',
			cache: 'no-cache',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.body == '') return RequestStatus.SERVER_ERROR;
		const body = new DOMParser().parseFromString(response.body, 'text/html');
		const header = body.querySelector<HTMLElement>('a.header-profile-link');
		if (header) {
			MyAnimeList.username = header.textContent!.trim();
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
	};

	static link(key: MediaKey): string {
		return `https://myanimelist.net/manga/${key.id}`;
	}
}

export class MyAnimeListTitle extends ExternalTitle {
	static service = MyAnimeList;

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

	static dateRowToDate = (body: Document, row: 'start' | 'finish'): Date | undefined => {
		const year = body.getElementById(`add_manga_${row}_date_year`) as HTMLSelectElement,
			month = body.getElementById(`add_manga_${row}_date_month`) as HTMLSelectElement,
			day = body.getElementById(`add_manga_${row}_date_day`) as HTMLSelectElement;
		if (month == null || day == null || year == null) return undefined;
		const parts: number[] = [parseInt(year.value), parseInt(month.value), parseInt(day.value)];
		if (parts.some((part) => isNaN(part))) return undefined;
		return new Date(parts[0], parts[1] - 1, parts[2]);
	};

	static async get(key: MediaKey): Promise<ExternalTitle | RequestStatus> {
		const response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/ownlist/manga/${key.id}/edit?hideLayout`,
			method: 'GET',
			cache: 'no-cache',
			credentials: 'include',
			redirect: 'follow',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		const values: Partial<MyAnimeListTitle> = { key: key };
		// name='csrf_token' content='0011223344556677788900112233445566777889'>
		const csrf = /'csrf_token'\s*content='(.{40})'/.exec(response.body);
		if (csrf !== null) values.csrf = csrf[1];
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const title = body.querySelector<HTMLElement>(`a[href^='/manga/']`);
		if (!response.redirected) {
			values.loggedIn = csrf !== null;
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
				values.start = MyAnimeListTitle.dateRowToDate(body, 'start');
				values.end = MyAnimeListTitle.dateRowToDate(body, 'finish');
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

	persist = async (): Promise<RequestStatus> => {
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
		if (this.progress.volume) body['add_manga[num_read_volumes]'] = this.progress.volume;
		else body['add_manga[num_read_volumes]'] = '';
		body['last_completed_vol'] = '';
		body['add_manga[num_read_chapters]'] = Math.floor(this.progress.chapter);
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
		if (this.status === Status.NONE || !this.csrf) {
			await log(`Could not sync MyAnimeList: status ${this.status} csrf ${!!this.csrf}`);
			return RequestStatus.BAD_REQUEST;
		}
		const response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/ownlist/manga/${this.key.id}delete`,
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `csrf_token=${this.csrf}`,
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.inList = true;
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

	static idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?myanimelist\.net\/manga\/(\d+)\/?/.exec(href);
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

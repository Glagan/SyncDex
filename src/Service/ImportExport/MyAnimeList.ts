import { DOM } from '../../Core/DOM';
import { ExportModule, ImportModule } from '../../Core/Module';
import { Runtime } from '../../Core/Runtime';
import { FoundTitle } from '../../Core/Title';
import { MyAnimeList, MyAnimeListTitle, MyAnimeListStatus } from '../Class/MyAnimeList';
import { dateFormatInput } from '../../Core/Utility';
import { LocalTitle } from '../../Core/Title';

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

	// Convert a MM-DD-YYYY MyAnimeList date to a Date timestamp
	dateToTime = (date?: string): Date | undefined => {
		if (date === undefined) return undefined;
		const parts = date.split('-').map((p) => parseInt(p));
		if (parts.length != 3) return undefined;
		const year = parts[2] > 25 ? 1900 + parts[2] : 2000 + parts[2];
		return new Date(year, Math.max(0, parts[0] - 1), parts[1]);
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
					name: `${title.manga_title}`,
					mochiKey: title.manga_id,
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

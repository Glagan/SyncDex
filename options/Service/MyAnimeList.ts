import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Status, LoginStatus } from '../../src/Service/Service';
import {
	ManageableService,
	FileImportableModule,
	FileImportFormat,
	BatchExportableModule,
	Summary,
	LoginMethod,
	ActivableModule,
} from './Service';
import { RawResponse, Runtime } from '../../src/Runtime';
import { MyAnimeList as MyAnimeListService } from '../../src/Service/MyAnimeList';

enum MyAnimeListStatus {
	COMPLETED = 'Completed',
	PLAN_TO_READ = 'Plan to Read',
	READING = 'Reading',
	PAUSED = 'On-Hold',
	DROPPED = 'Dropped',
	NONE = 'Invalid',
}

interface MyAnimeListTitle {
	id: number;
	chapters: number;
	volumes: number;
	status: MyAnimeListStatus;
	start: string;
	end: string;
	score: number;
}

class MyAnimeListActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://myanimelist.net/login.php';
	login = undefined;
	logout = undefined;

	isLoggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: this.loginUrl,
			method: 'GET',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (response.ok && response.body && response.url.indexOf('login.php') < 0) {
			return LoginStatus.SUCCESS;
		}
		return LoginStatus.FAIL;
	};
}

/**
 * MyAnimeList Document
 * <myanimelist>
 * 		<myinfo>
 * 			user_id: number
 * 			user_name: string
 * 			user_export_type: 1 (anime), 2 (manga)
 * 			user_total_manga: number
 * 			user_total_reading: number
 * 			user_total_completed: number
 * 			user_total_onhold: number
 * 			user_total_dropped: number
 * 			user_total_plantoread: number
 * 		</myinfo>
 * 		<manga>
 * 			 manga_mangadb_id: number
 * 			 manga_title: string, CDATA
 * 			 manga_volumes: number
 * 			 manga_chapters: number
 * 			 my_id: number
 * 			 my_read_volumes: number
 * 			 my_read_chapters: number
 * 			 my_start_date: date, default to 0000-00-00 (year-month-day)
 * 			 my_finish_date: date, ^
 * 			 my_scanalation_group: string, CDATA
 * 			 my_score: number
 * 			 my_storage: TODO
 * 			 my_status: Completed, Plan to Read, Reading, On-Hold, Dropped
 * 			 my_comments: string, CDATA
 * 			 my_times_read: number
 * 			 my_tags: string, CDATA
 * 			 my_reread_value: TODO
 * 			 update_on_import: number, 0 to not edit, 1 to edit
 * 		</manga>
 * </myanimelist>
 */
class MyAnimeListImport extends FileImportableModule<Document, MyAnimeListTitle> {
	fileType: FileImportFormat = 'XML';
	handleHistory = undefined;
	handleOptions = undefined;

	preForm = (): void => {
		this.notification('info', [
			DOM.text('You can download your Manga list'),
			DOM.space(),
			DOM.create('a', {
				textContent: 'here',
				attributes: {
					href: 'https://myanimelist.net/panel.php?go=export',
					rel: 'noreferrer noopener',
					target: '_blank',
				},
			}),
			DOM.text('.'),
		]);
		this.notification(
			'warning',
			'You need to extract the downloaded file before uploading, the extension need to be xml and not gz.'
		);
	};

	inputMessage = (): string => {
		return 'MyAnimeList export file (.xml)';
	};

	toStatus = (status: MyAnimeListStatus): Status => {
		if (status == 'Completed') {
			return Status.COMPLETED;
		} else if (status == 'Plan to Read') {
			return Status.PLAN_TO_READ;
		} else if (status == 'Reading') {
			return Status.READING;
		} else if (status == 'On-Hold') {
			return Status.PAUSED;
		} else if (status == 'Dropped') {
			return Status.DROPPED;
		}
		return Status.NONE;
	};

	validMyAnimeListTitle = (title: MyAnimeListTitle): boolean => {
		return (
			!isNaN(title.id) &&
			!isNaN(title.chapters) &&
			!isNaN(title.volumes) &&
			this.toStatus(title.status) !== Status.NONE &&
			title.status !== MyAnimeListStatus.NONE
		);
	};

	// Convert a YYYY-MM-DD MyAnimeList date to a Date timestamp
	dateToTime = (date: string): number | undefined => {
		const d = new Date(date);
		if (d.getFullYear() == 0) return undefined;
		return d.getTime();
	};

	convertTitle = async (title: MyAnimeListTitle, titles: TitleCollection): Promise<boolean> => {
		const connections = await Mochi.find(title.id, 'MyAnimeList');
		if (connections !== undefined && connections['MangaDex'] !== undefined) {
			titles.add(
				new Title(connections['MangaDex'] as number, {
					services: { mal: title.id },
					progress: {
						chapter: title.chapters,
						volume: title.volumes,
					},
					status: this.toStatus(title.status),
					score: title.score > 0 ? title.score : undefined,
					start: this.dateToTime(title.start),
					end: this.dateToTime(title.end),
					chapters: [],
				})
			);
			return true;
		}
		return false;
	};

	handleTitles = async (save: Document): Promise<MyAnimeListTitle[]> => {
		let titles: MyAnimeListTitle[] = [];
		const mangaList = save.querySelectorAll<HTMLElement>('manga');
		for (const manga of mangaList) {
			const title: MyAnimeListTitle = {
				id: parseInt(manga.querySelector('manga_mangadb_id')?.textContent || ''),
				chapters: parseInt(manga.querySelector('my_read_chapters')?.textContent || ''),
				volumes: parseInt(manga.querySelector('my_read_volumes')?.textContent || ''),
				status: (manga.querySelector('my_status')?.textContent || 'Invalid') as MyAnimeListStatus,
				score: parseInt(manga.querySelector('my_score')?.textContent || '0'),
				start: manga.querySelector('my_start_date')?.textContent || '0000-00-00',
				end: manga.querySelector('my_finish_date')?.textContent || '0000-00-00',
			};
			if (this.validMyAnimeListTitle(title)) {
				titles.push(title);
			}
		}
		return titles;
	};
}

/**
 * Export format is the same as the Import XML file.
 * Only user_export_type set to 2 is require in myinfo
 * The only two required fields in each manga are manga_mangadb_id and update_on_import set to 1
 * XMLHeader: <?xml version="1.0" encoding="UTF-8" ?>
 */
class MyAnimeListExport extends BatchExportableModule<string> {
	// Create an xml node of type <type> and a value of <value>
	node = (document: Document, type: string, value?: string | number): HTMLElement => {
		const node = document.createElement(type);
		if (value !== undefined) node.textContent = typeof value === 'number' ? value.toString() : value;
		return node;
	};

	// Convert to YYYY-MM-DD MyAnimeList use
	timeToDate = (time: number): string => {
		const d = new Date(time);
		return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
	};

	fromStatus = (status: Status): MyAnimeListStatus => {
		if (status == Status.COMPLETED) {
			return MyAnimeListStatus.COMPLETED;
		} else if (status == Status.PLAN_TO_READ) {
			return MyAnimeListStatus.PLAN_TO_READ;
		} else if (status == Status.READING) {
			return MyAnimeListStatus.READING;
		} else if (status == Status.PAUSED) {
			return MyAnimeListStatus.PAUSED;
		} else if (status == Status.DROPPED) {
			return MyAnimeListStatus.DROPPED;
		}
		return MyAnimeListStatus.NONE;
	};

	createTitle = (document: Document, title: Title): HTMLElement => {
		const node = document.createElement('manga');
		DOM.append(
			node,
			this.node(document, 'manga_mangadb_id', title.services.mal as number),
			this.node(document, 'my_status', this.fromStatus(title.status)),
			this.node(document, 'my_read_chapters', title.progress.chapter),
			this.node(document, 'update_on_import', 1)
		);
		if (title.progress.volume) {
			node.appendChild(this.node(document, 'my_read_volumes', title.progress.volume));
		}
		if (title.start) {
			node.appendChild(this.node(document, 'my_start_date', this.timeToDate(title.start)));
		}
		if (title.end) {
			node.appendChild(this.node(document, 'my_finish_date', this.timeToDate(title.end)));
		}
		return node;
	};

	generateBatch = async (titles: Title[]): Promise<string> => {
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

	sendBatch = async (batch: string, summary: Summary): Promise<boolean> => {
		// Get CSRF token
		const importPage = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/import.php`,
			method: 'GET',
			credentials: 'include',
		});
		const csrfTokenArr = /'csrf_token'\scontent='(.{40})'/.exec(importPage.body);
		if (!csrfTokenArr) return false;
		// Upload file and look at response
		const response = await Runtime.request<RawResponse>({
			url: `http://localhost/import.php`,
			method: 'POST',
			credentials: 'include',
			body: {
				importtype: '3',
				subimport: 'Import Data',
				csrf_token: csrfTokenArr[1],
				mal: {
					content: [batch],
					name: 'mal_export.xml',
					options: {
						type: 'text/xml',
					},
				},
			},
		});
		// Update summary with number of updated titles
		if (response.status == 200) {
			const totalArr = /Total\s*Entries\s*Updated:\s*(\d+)/.exec(response.body);
			const totalUpdated = totalArr ? +totalArr[1] : 0;
			summary.valid = totalUpdated;
			return true;
		}
		return false;
	};
}

export class MyAnimeList extends ManageableService {
	service = new MyAnimeListService(); // TODO: MyAnimeListStatus is not the good one
	activeModule: MyAnimeListActive = new MyAnimeListActive(this);
	importModule: MyAnimeListImport = new MyAnimeListImport(this);
	exportModule: MyAnimeListExport = new MyAnimeListExport(this);
}

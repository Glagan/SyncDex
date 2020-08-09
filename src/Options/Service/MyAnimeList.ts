import { DOM } from '../../Core/DOM';
import { TitleCollection, Title, ServiceName, ServiceKey, ServiceKeyType } from '../../Core/Title';
import { Mochi } from '../../Core/Mochi';
import { Service, Summary, LoginMethod, ActivableModule, LoginModule, ActivableService } from './Service';
import { Runtime } from '../../Core/Runtime';
import { MyAnimeListTitle } from '../../Service/MyAnimeList';
import { FileImportFormat, FileImportableModule } from './Import';
import { BatchExportableModule } from './Export';
import { dateFormat } from '../../Core/Utility';

enum MyAnimeListExportStatus {
	COMPLETED = 'Completed',
	PLAN_TO_READ = 'Plan to Read',
	READING = 'Reading',
	PAUSED = 'On-Hold',
	DROPPED = 'Dropped',
	NONE = 'Invalid',
}

interface MyAnimeListXMLTitle {
	id: number;
	chapters: number;
	volumes: number;
	status: MyAnimeListExportStatus;
	start: string;
	end: string;
	score: number;
	name?: string;
}

class MyAnimeListLogin extends LoginModule {
	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://myanimelist.net/login.php',
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.body == '') return RequestStatus.SERVER_ERROR;
		if (response.body && response.url.indexOf('login.php') < 0) return RequestStatus.SUCCESS;
		return RequestStatus.FAIL;
	};
}

class MyAnimeListActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://myanimelist.net/login.php';
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
 * 			 my_score: number, 0-10 range
 * 			 my_storage: None for manga ?
 * 			 my_status: Completed, Plan to Read, Reading, On-Hold, Dropped
 * 			 my_comments: string, CDATA
 * 			 my_times_read: number
 * 			 my_tags: string, CDATA
 * 			 my_reread_value: Very Low, Low, Medium, High, Very High
 * 			 update_on_import: number, 0 to not edit, 1 to edit
 * 		</manga>
 * </myanimelist>
 */
class MyAnimeListImport extends FileImportableModule<Document, MyAnimeListXMLTitle> {
	fileType: FileImportFormat = 'XML';
	handleHistory = undefined;
	handleOptions = undefined;

	acceptedFileType = () => {
		return 'application/xml';
	};

	postForm = (form: HTMLFormElement): void => {
		const fileInput = form.querySelector(`input[type='file']`);
		if (fileInput && fileInput.parentElement) {
			// Link to the export panel on MyAnimeList
			let notification = this.notification('default', [
				DOM.text('You can download your Manga list'),
				DOM.space(),
				DOM.create('a', {
					textContent: 'here',
					href: 'https://myanimelist.net/panel.php?go=export',
					target: '_blank',
					childs: [DOM.space(), DOM.icon('external-link-alt')],
				}),
				DOM.text('.'),
			]);
			notification.classList.add('in-place');
			fileInput.parentElement.insertBefore(notification, fileInput);
			// Compression notification
			notification = this.notification('warning', [
				DOM.text('You need to extract the downloaded file. The extension need to be '),
				DOM.create('b', { textContent: '.xml' }),
				DOM.text(' and not '),
				DOM.create('b', { textContent: '.xml.gz' }),
				DOM.text('.'),
			]);
			notification.classList.add('in-place');
			fileInput.parentElement.insertBefore(notification, fileInput);
		}
	};

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

	validMyAnimeListTitle = (title: MyAnimeListXMLTitle): boolean => {
		return (
			!isNaN(+title.id) &&
			!isNaN(+title.chapters) &&
			!isNaN(+title.volumes) &&
			!isNaN(+title.score) &&
			typeof title.start === 'string' &&
			typeof title.end === 'string' &&
			this.toStatus(title.status) !== Status.NONE
		);
	};

	// Convert a YYYY-MM-DD MyAnimeList date to a Date timestamp
	dateToTime = (date?: string): Date | undefined => {
		if (date === undefined) return undefined;
		const d = new Date(date);
		if (isNaN(d.getFullYear()) || d.getFullYear() === 0) return undefined;
		return d;
	};

	handleTitles = async (save: Document): Promise<MyAnimeListXMLTitle[]> => {
		let titles: MyAnimeListXMLTitle[] = [];
		const mangaList = save.querySelectorAll<HTMLElement>('manga');
		for (const manga of mangaList) {
			const title: MyAnimeListXMLTitle = {
				id: parseInt(manga.querySelector('manga_mangadb_id')?.textContent || '0'),
				chapters: parseInt(manga.querySelector('my_read_chapters')?.textContent || '0'),
				volumes: parseInt(manga.querySelector('my_read_volumes')?.textContent || '0'),
				status: (manga.querySelector('my_status')?.textContent || 'Invalid') as MyAnimeListExportStatus,
				score: parseInt(manga.querySelector('my_score')?.textContent || '0'),
				start: '0000-00-00',
				end: '0000-00-00',
				name: manga.querySelector('manga_title')?.textContent || undefined,
			};
			const start = manga.querySelector('my_start_date');
			if (start !== null && start.textContent !== null) {
				title.start = start.textContent;
			}
			const end = manga.querySelector('my_finish_date');
			if (end && end.textContent !== null) {
				title.end = end.textContent;
			}
			if (this.validMyAnimeListTitle(title)) {
				titles.push(title);
			}
		}
		return titles;
	};

	convertTitles = async (titles: TitleCollection, titleList: MyAnimeListXMLTitle[]): Promise<number> => {
		const ids = titleList
			.filter((title) => {
				return title.id > 0 && title.chapters >= 0 && title.status != MyAnimeListExportStatus.NONE;
			})
			.map((t) => t.id);
		const connections = await Mochi.findMany(ids, this.service.serviceName);
		const found: number[] = [];
		let total = 0;
		if (connections !== undefined) {
			for (const key in connections) {
				const connection = connections[key];
				if (connection !== undefined) {
					const id = parseInt(key);
					const title = titleList.find((t) => t.id == id);
					if (title && connection['md']) {
						titles.add(
							new Title(connection['md'] as number, {
								services: { mal: title.id },
								progress: {
									chapter: title.chapters,
									volume: title.volumes,
								},
								status: this.toStatus(title.status),
								// Convert MyAnimeList 0-10 range to 0-100
								score: title.score > 0 ? title.score * 10 : undefined,
								start: this.dateToTime(title.start),
								end: this.dateToTime(title.end),
								chapters: [],
								name: title.name,
							})
						);
						found.push(title.id);
						total++;
					}
				}
			}
			// Find title that don't have a connection
			const noIds = titleList.filter((mt) => found.indexOf(mt.id) < 0);
			this.summary.failed.push(...noIds.filter((mt) => mt.name !== undefined).map((mt) => mt.name as string));
		}
		return total;
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

	createTitle = (document: Document, title: Title): HTMLElement => {
		const node = document.createElement('manga');
		DOM.append(
			node,
			this.node(document, 'manga_mangadb_id', title.services.mal as number),
			this.node(document, 'my_status', this.fromStatus(title.status)),
			this.node(document, 'my_read_chapters', title.progress.chapter),
			this.node(document, 'update_on_import', 1)
		);
		if (title.score > 0) {
			// Conver back to the 0-10 range
			node.appendChild(this.node(document, 'my_score', Math.round(title.score / 10)));
		}
		if (title.progress.volume) {
			node.appendChild(this.node(document, 'my_read_volumes', title.progress.volume));
		}
		if (title.start) {
			node.appendChild(this.node(document, 'my_start_date', dateFormat(title.start)));
		}
		if (title.end) {
			node.appendChild(this.node(document, 'my_finish_date', dateFormat(title.end)));
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
		let response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/import.php`,
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return false;
		const csrfTokenArr = /'csrf_token'\scontent='(.{40})'/.exec(response.body);
		if (!csrfTokenArr) return false;
		// Upload file and look at response
		response = await Runtime.request<RawResponse>({
			url: `https://myanimelist.net/import.php`,
			method: 'POST',
			credentials: 'include',
			body: <FormDataProxy>{
				importtype: '3',
				subimport: 'Import Data',
				csrf_token: csrfTokenArr[1],
				mal: <FormDataFile>{
					content: [batch],
					name: 'mal_export.xml',
					options: {
						type: 'text/xml',
					},
				},
			},
		});
		if (!response.ok) return false;
		// Update summary with number of updated titles	if (response.code == 200) {
		const totalArr = /Total\s*Entries\s*Updated:\s*(\d+)/.exec(response.body);
		const totalUpdated = totalArr ? +totalArr[1] : 0;
		summary.valid = totalUpdated;
		return true;
	};
}

export class MyAnimeList extends Service implements ActivableService {
	static readonly serviceName: ServiceName = ServiceName.MyAnimeList;
	static readonly key: ServiceKey = ServiceKey.MyAnimeList;

	static link(id: ServiceKeyType): string {
		if (typeof id !== 'number') return '#';
		return MyAnimeListTitle.link(id);
	}

	loginModule: MyAnimeListLogin = new MyAnimeListLogin();
	activeModule: MyAnimeListActive = new MyAnimeListActive(this);
	importModule: MyAnimeListImport = new MyAnimeListImport(this);
	exportModule: MyAnimeListExport = new MyAnimeListExport(this);
}
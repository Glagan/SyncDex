import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { Service, ActivableModule, ExportableModule, FileImportableModule, FileImportFormat } from './Service';
import { ServiceName } from '../Manager/Service';
import { RawResponse, Runtime } from '../../src/Runtime';

enum MyAnimeListStatus {
	Completed = 'Completed',
	'Plan to Read' = 'Plan to Read',
	Reading = 'Reading',
	'On-Hold' = 'On-Hold',
	Dropped = 'Dropped',
	Invalid = 'Invalid',
}

interface MyAnimeListTitle {
	id: number;
	chapters: number;
	volumes: number;
	status: MyAnimeListStatus;
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
		if (response.status >= 200 && response.status < 400 && response.body && response.url.indexOf('login.php') < 0)
			return LoginStatus.SUCCESS;
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
 * 			 my_status: TODO
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

	validMyAnimeListTitle = (title: MyAnimeListTitle): boolean => {
		return (
			!isNaN(title.id) &&
			!isNaN(title.chapters) &&
			!isNaN(title.volumes) &&
			MyAnimeListStatus[title.status] !== undefined &&
			title.status !== MyAnimeListStatus.Invalid
		);
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
			const title = {
				id: parseInt(manga.querySelector('manga_mangadb_id')?.textContent || ''),
				chapters: parseInt(manga.querySelector('my_read_chapters')?.textContent || ''),
				volumes: parseInt(manga.querySelector('my_read_volumes')?.textContent || ''),
				status: (manga.querySelector('my_status')?.textContent || 'Invalid') as MyAnimeListStatus,
			};
			if (this.validMyAnimeListTitle(title)) {
				titles.push(title);
			}
		}
		return titles;
	};
}

class MyAnimeListExport extends ExportableModule {
	// TODO: Export to XML and upload file
	export = async (): Promise<void> => {};
}

export class MyAnimeList extends Service {
	name: ServiceName = ServiceName.MyAnimeList;
	key: string = 'mal';

	activeModule: ActivableModule = new MyAnimeListActive(this);
	importModule: FileImportableModule<Document, MyAnimeListTitle> = new MyAnimeListImport(this);
	exportModule: ExportableModule = new MyAnimeListExport(this);
}

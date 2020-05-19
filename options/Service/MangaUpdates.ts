import { Progress } from '../../src/interfaces';
import { Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { Runtime, RawResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Service, ActivableModule, ExportableModule, APIImportableModule, ImportStep } from './Service';
import { ServiceName } from '../Manager/Service';

interface MangaUpdatesTitle {
	id: number;
	progress: Progress;
	status: Status;
}

class MangaUpdatesActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.mangaupdates.com/login.html';
	login = undefined;
	logout = undefined;

	isLoggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body &&
			response.body.indexOf(`You are currently logged in as`) >= 0
		)
			return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};
}

class MangaUpdatesImport extends APIImportableModule<MangaUpdatesTitle> {
	needReference: boolean = false;
	parser: DOMParser = new DOMParser();
	currentPage: string = '';
	currentList: number = 0;
	static lists: string[] = ['read', 'wish', 'complete', 'unfinished', 'hold'];

	progressFromNode = (node: HTMLElement | null): number => {
		if (node !== null) {
			return parseInt((node.textContent as string).slice(2));
		}
		return 0;
	};

	toStatus = (list: string): Status => {
		if (list === 'read') {
			return Status.READING;
		} else if (list === 'wish') {
			return Status.PLAN_TO_READ;
		} else if (list === 'complete') {
			return Status.COMPLETED;
		} else if (list === 'unfinished') {
			return Status.DROPPED;
		} else if (list === 'hold') {
			return Status.PAUSED;
		}
		return Status.NONE;
	};

	getNextPage = (): boolean => {
		if (this.currentList == MangaUpdatesImport.lists.length) {
			return false;
		}
		this.currentPage = MangaUpdatesImport.lists[this.currentList++];
		return true;
	};

	getProgress = (step: ImportStep, total?: number): string => {
		if (step == ImportStep.FETCH_PAGES) {
			return `Importing list ${this.currentList} out of 5.`;
		}
		// ImportStep.CONVERT_TITLES
		return `Converting title ${++this.currentTitle} out of ${total}.`;
	};

	handlePage = async (): Promise<MangaUpdatesTitle[] | false> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/mylist.html?list=${this.currentPage}`,
			credentials: 'include',
		});
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body.indexOf('You must be a user to access this page.') < 0
		) {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll(`div[id^='r']`);
			const status = this.toStatus(MangaUpdatesImport.lists[this.currentList - 1]);
			let titles: MangaUpdatesTitle[] = [];
			for (const row of rows) {
				titles.push({
					id: parseInt(row.id.slice(1)),
					progress: {
						chapter: this.progressFromNode(row.querySelector(`a[title='Increment Chapter']`)),
						volume: this.progressFromNode(row.querySelector(`a[title='Increment Volume']`)),
					},
					status: status,
				});
			}
			return titles;
		}
		return false;
	};

	convertTitle = async (titles: TitleCollection, title: MangaUpdatesTitle): Promise<boolean> => {
		const connections = await Mochi.find(title.id, 'MangaUpdates');
		if (connections !== undefined && connections['MangaDex'] !== undefined) {
			titles.add(
				new Title(connections['MangaDex'] as number, {
					services: { mu: title.id },
					progress: title.progress,
					status: title.status,
					chapters: [],
				})
			);
			return true;
		}
		return false;
	};
}

class MangaUpdatesExport extends ExportableModule {
	export = async (): Promise<void> => {
		// 1: Load all titles with MangaUpdates ID
		// 2: Update entries one by one
	};
}

export class MangaUpdates extends Service {
	name: ServiceName = ServiceName.MangaUpdates;
	key: string = 'mu';

	activeModule: ActivableModule = new MangaUpdatesActive(this);
	importModule: APIImportableModule<MangaUpdatesTitle> = new MangaUpdatesImport(this);
	exportModule: ExportableModule = new MangaUpdatesExport(this);
}

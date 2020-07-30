import { Runtime, RequestStatus } from '../../src/Runtime';
import { Service, ActivableModule, LoginMethod, LoginModule, ActivableService } from './Service';
import { MangaUpdatesTitle } from '../../src/Service/MangaUpdates';
import { LocalTitle, ServiceName, ServiceKey, ServiceKeyType, ActivableName, ActivableKey } from '../../src/Title';
import { APIImportableModule } from './Import';
import { APIExportableModule } from './Export';

class MangaUpdatesLogin extends LoginModule {
	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.body && response.body.indexOf(`You are currently logged in as`) >= 0) return RequestStatus.SUCCESS;
		return RequestStatus.FAIL;
	};
}

class MangaUpdatesActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.mangaupdates.com/login.html';
}

class MangaUpdatesImport extends APIImportableModule {
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

	getNextPage = (): boolean => {
		if (this.currentList == MangaUpdatesImport.lists.length) {
			return false;
		}
		this.currentPage = MangaUpdatesImport.lists[this.currentList++];
		return true;
	};

	importProgress = (): string => {
		return `Importing list ${this.currentList} out of 5.`;
	};

	handlePage = async (): Promise<MangaUpdatesTitle[] | false> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/mylist.html?list=${this.currentPage}`,
			credentials: 'include',
		});
		if (response.ok && response.body.indexOf('You must be a user to access this page.') < 0) {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll(`div[id^='r']`);
			const status = MangaUpdatesTitle.listToStatus(MangaUpdatesImport.lists[this.currentList - 1]);
			let titles: MangaUpdatesTitle[] = [];
			for (const row of rows) {
				const scoreLink = row.querySelector(`a[title='Update Rating']`);
				let score: number | undefined;
				if (scoreLink !== null) {
					score = parseInt(scoreLink.textContent as string) * 10;
					if (isNaN(score)) score = undefined;
				}
				const name = row.querySelector(`a[title='Series Info']`) as HTMLElement;
				titles.push(
					new MangaUpdatesTitle(parseInt(row.id.slice(1)), {
						progress: {
							chapter: this.progressFromNode(row.querySelector(`a[title='Increment Chapter']`)),
							volume: this.progressFromNode(row.querySelector(`a[title='Increment Volume']`)),
						},
						status: MangaUpdatesTitle.toStatus(status),
						score: score,
						name: name.textContent as string,
					})
				);
			}
			return titles;
		}
		return false;
	};
}

class MangaUpdatesExport extends APIExportableModule {
	onlineList: { [key: string]: MangaUpdatesTitle | undefined } = {};

	// We need the status of each titles before to move them from lists to lists
	// Use ImportModule and get a list of MangaUpdatesTitles
	preMain = async (_titles: LocalTitle[]): Promise<boolean> => {
		let notification = this.notification('loading', 'Checking current status of each titles...');
		const importModule = new MangaUpdatesImport(this.service);
		while (!this.doStop && importModule.getNextPage() !== false) {
			let tmp: MangaUpdatesTitle[] | false = await importModule.handlePage();
			if (tmp === false) {
				notification.classList.remove('loading');
				return false;
			}
			for (const title of tmp) {
				this.onlineList[title.id] = title;
			}
		}
		notification.classList.remove('loading');
		return true;
	};

	exportTitle = async (title: LocalTitle): Promise<boolean> => {
		const exportTitle = title.toExternal(MangaUpdates.key) as MangaUpdatesTitle | undefined;
		if (exportTitle && exportTitle.status !== Status.NONE) {
			const onlineTitle = this.onlineList[exportTitle.id];
			if (onlineTitle) {
				exportTitle.current = {
					progress: onlineTitle.progress,
					status: onlineTitle.status,
					score: onlineTitle.score,
				};
			}
			const responseStatus = await exportTitle.persist();
			return responseStatus == RequestStatus.SUCCESS;
		}
		return false;
	};
}

export class MangaUpdates extends Service implements ActivableService {
	static readonly serviceName: ActivableName = ActivableName.MangaUpdates;
	static readonly key: ActivableKey = ActivableKey.MangaUpdates;

	static link(id: ServiceKeyType): string {
		if (typeof id !== 'number') return '#';
		return MangaUpdatesTitle.link(id);
	}

	loginModule: MangaUpdatesLogin = new MangaUpdatesLogin();
	activeModule: MangaUpdatesActive = new MangaUpdatesActive(this);
	importModule: MangaUpdatesImport = new MangaUpdatesImport(this);
	exportModule: MangaUpdatesExport = new MangaUpdatesExport(this);
}

import { TitleCollection, Title } from '../../src/Title';
import { Runtime, RawResponse } from '../../src/Runtime';
import { Status, Service, ServiceKey, LoginStatus, ServiceName } from '../../src/Service/Service';
import { ManageableService, APIImportableModule, APIExportableModule } from './Service';

class MangaDexService extends Service {
	key: ServiceKey = ServiceKey.MangaDex;
	name: ServiceName = ServiceName.MangaDex;
	parser: DOMParser = new DOMParser();
	user: number = 0;

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/about`,
			credentials: 'include',
		});
		if (response.status >= 400) {
			return LoginStatus.FAIL;
		}
		try {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const profileLink = body.querySelector('a[href^="/user/"]');
			if (profileLink === null) {
				throw 'Could not find Profile link';
			}
			const res = /\/user\/(\d+)\//.exec(profileLink.getAttribute('href') ?? '');
			if (res === null) {
				throw 'Could not find User ID';
			}
			this.user = parseInt(res[1]);
			return LoginStatus.SUCCESS;
		} catch (error) {
			return LoginStatus.FAIL;
		}
	};

	toStatus = (status: Status): Status => {
		return status;
	};

	fromStatus = (status: Status): Status => {
		return status;
	};
}

class MangaDexImport extends APIImportableModule<Title> {
	parser: DOMParser = new DOMParser();
	convertManyTitles = undefined;

	handlePage = async (): Promise<Title[] | false> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/list/${(this.manager.service as MangaDexService).user}/0/2/${
				this.state.current
			}`,
			credentials: 'include',
		});
		if (response.status >= 400 || typeof response.body !== 'string') {
			this.notification('danger', 'The request failed, maybe MangaDex is having problems, retry later.');
			return false;
		}
		if (response.body.indexOf(`You do not have permission to view this user's list.`) >= 0) {
			this.notification(
				'danger',
				'You do not have the required Permissions to view this list, check if you are logged in.'
			);
			return false;
		}
		const body = this.parser.parseFromString(response.body, 'text/html');
		// Each row has a data-id field
		let titles: Title[] = [];
		const rows = body.querySelectorAll<HTMLElement>('.manga-entry');
		for (const row of rows) {
			const id = parseInt(row.dataset.id || '');
			if (!isNaN(id)) {
				const status = row.querySelector<HTMLElement>('.dropdown-menu > .disabled');
				const score = row.querySelector('.disabled.manga_rating_button');
				titles.push(
					new Title(id, {
						status: status
							? this.manager.service.toStatus(parseInt(status.getAttribute('id') as string))
							: Status.NONE,
						score: score ? parseInt(score.getAttribute('id') as string) : undefined,
						name: (row.querySelector('.manga_title') as HTMLElement).textContent as string,
					})
				);
			}
		}
		// Get the last page number -- in the URL of the link to the last page
		const navigation = body.querySelector('nav > ul.pagination') as HTMLElement | null;
		if (navigation !== null) {
			const goLast = navigation.lastElementChild as HTMLElement;
			const goLastLink = goLast.firstElementChild;
			if (goLastLink) {
				const regRes = /\/(\d+)\/?$/.exec((goLastLink as HTMLLinkElement).href);
				if (regRes !== null && regRes.length == 2) {
					this.state.max = parseInt(regRes[1]);
				}
			}
		}
		return titles;
	};

	convertTitles = async (titles: TitleCollection, titleList: Title[]): Promise<number> => {
		titles.add(...titleList);
		return titleList.length;
	};
}

class MangaDexExport extends APIExportableModule {
	selectTitles = async (): Promise<Title[]> => {
		return (await TitleCollection.get()).collection;
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		const status = this.manager.service.fromStatus(title.status);
		if (status > 0) {
			const response = await Runtime.request<RawResponse>({
				url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${
					title.id
				}&type=${status}&_=${Date.now()}`,
				credentials: 'include',
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
				},
			});
			return response.ok;
		}
		return false;
	};
}

export class MangaDex extends ManageableService {
	service: MangaDexService = new MangaDexService();
	activeModule = undefined;
	importModule: MangaDexImport = new MangaDexImport(this);
	exportModule: MangaDexExport = new MangaDexExport(this);
}

import { TitleCollection, Title, ServiceName, ServiceKey, ServiceKeyType } from '../../src/Title';
import { Runtime, RequestStatus } from '../../src/Runtime';
import { Service, APIImportableModule, APIExportableModule, ActivableModule, LoginMethod } from './Service';
import { AppendableElement, DOM } from '../../src/DOM';
import { MangaDexTitle } from '../../src/Service/MangaDex';

class MangaDexActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://mangadex.org/login';
	activable: boolean = false;

	parser: DOMParser = new DOMParser();
	user: number = 0;

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/about`,
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
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
			return RequestStatus.SUCCESS;
		} catch (error) {
			return RequestStatus.FAIL;
		}
	};
}

class MangaDexImport extends APIImportableModule<MangaDexTitle> {
	parser: DOMParser = new DOMParser();

	handlePage = async (): Promise<MangaDexTitle[] | false> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/list/${(this.service as MangaDex).activeModule.user}/0/2/${this.state.current}`,
			credentials: 'include',
		});
		if (!response.ok || typeof response.body !== 'string') {
			this.notification('warning', 'The request failed, maybe MangaDex is having problems, retry later.');
			return false;
		}
		if (response.body.indexOf(`You do not have permission to view this user's list.`) >= 0) {
			this.notification(
				'warning',
				'You do not have the required Permissions to view this list, check if you are logged in.'
			);
			return false;
		}
		const body = this.parser.parseFromString(response.body, 'text/html');
		// Each row has a data-id field
		let titles: MangaDexTitle[] = [];
		const rows = body.querySelectorAll<HTMLElement>('.manga-entry');
		for (const row of rows) {
			const id = parseInt(row.dataset.id || '');
			if (!isNaN(id)) {
				const status = row.querySelector<HTMLElement>('.dropdown-menu > .disabled');
				// MangaDex has a simple 0-10 range
				const score = row.querySelector('.disabled.manga_rating_button');
				titles.push(
					new MangaDexTitle(id, {
						status: status ? parseInt(status.getAttribute('id') as string) : Status.NONE,
						score: score ? parseInt(score.getAttribute('id') as string) * 10 : undefined,
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

	convertTitles = async (titles: TitleCollection, titleList: MangaDexTitle[]): Promise<number> => {
		titles.add(...(titleList.map((title) => title.toTitle()).filter((title) => title !== undefined) as Title[]));
		return titleList.length;
	};
}

class MangaDexExport extends APIExportableModule {
	selectTitles = async (titleCollection: TitleCollection): Promise<Title[]> => {
		return titleCollection.collection.filter((title) => title.status != Status.NONE);
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = MangaDexTitle.fromTitle(title);
		if (exportTitle && exportTitle.status !== Status.NONE) {
			const responseStatus = await exportTitle.persist();
			return responseStatus == RequestStatus.SUCCESS;
		}
		return false;
	};
}

export class MangaDex extends Service {
	static readonly serviceName: ServiceName = ServiceName.MangaDex;
	static readonly key: ServiceKey = ServiceKey.MangaDex;

	static link(id: ServiceKeyType): string {
		if (typeof id !== 'number') return '#';
		return MangaDexTitle.link(id);
	}

	createTitle = (): AppendableElement => {
		return DOM.create('span', {
			class: 'manga',
			textContent: 'Manga',
			childs: [
				DOM.create('span', {
					class: 'dex',
					textContent: 'Dex',
				}),
			],
		});
	};

	activeModule: MangaDexActive = new MangaDexActive(this);
	importModule: MangaDexImport = new MangaDexImport(this);
	exportModule: MangaDexExport = new MangaDexExport(this);
}

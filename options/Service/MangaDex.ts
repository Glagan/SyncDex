import { TitleCollection, Title, ServiceTitle } from '../../src/Title';
import { Runtime, RawResponse, RequestStatus } from '../../src/Runtime';
import { Service, APIImportableModule, APIExportableModule, ActivableModule, LoginMethod } from './Service';
import { AppendableElement, DOM } from '../../src/DOM';
import { ServiceKey, ServiceName, Status } from '../../src/core';

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
		if (response.status >= 400) {
			return RequestStatus.FAIL;
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
			return RequestStatus.SUCCESS;
		} catch (error) {
			return RequestStatus.FAIL;
		}
	};

	login = undefined;
	logout = undefined;
}

class MangaDexTitle extends ServiceTitle<MangaDexTitle> {
	readonly serviceKey: ServiceKey = ServiceKey.MangaDex;
	readonly serviceName: ServiceName = ServiceName.MangaDex;

	status: Status = Status.NONE;

	static get = async <T extends ServiceTitle<T> = MangaDexTitle>(id: number | string): Promise<RequestStatus> => {
		return RequestStatus.FAIL;
	};

	persist = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${this.id}&type=${
				this.status
			}&_=${Date.now()}`,
			credentials: 'include',
			headers: {
				'X-Requested-With': 'XMLHttpRequest',
			},
		});
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		return RequestStatus.FAIL;
	};

	toTitle = (): Title | undefined => {
		return new Title(this.id as number, {
			progress: this.progress,
			status: this.status,
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			name: this.name,
		});
	};

	static fromTitle = <T extends ServiceTitle<T> = MangaDexTitle>(title: Title): MangaDexTitle | undefined => {
		if (!title.services.al) return undefined;
		return new MangaDexTitle(title.services.al, {
			progress: title.progress,
			status: title.status,
			score: title.score,
			name: title.name,
		});
	};
}

class MangaDexImport extends APIImportableModule<MangaDexTitle> {
	parser: DOMParser = new DOMParser();

	handlePage = async (): Promise<MangaDexTitle[] | false> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/list/${(this.service as MangaDex).activeModule.user}/0/2/${this.state.current}`,
			credentials: 'include',
		});
		if (response.status >= 400 || typeof response.body !== 'string') {
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
				const score = row.querySelector('.disabled.manga_rating_button');
				titles.push(
					new MangaDexTitle(id, {
						status: status ? parseInt(status.getAttribute('id') as string) : Status.NONE,
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

	convertTitles = async (titles: TitleCollection, titleList: MangaDexTitle[]): Promise<number> => {
		titles.add(...(titleList.map((title) => title.toTitle()).filter((title) => title !== undefined) as Title[]));
		return titleList.length;
	};
}

class MangaDexExport extends APIExportableModule {
	selectTitles = async (): Promise<Title[]> => {
		return (await TitleCollection.get()).collection.filter((title) => title.status != Status.NONE);
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
	key: ServiceKey = ServiceKey.MangaDex;
	name: ServiceName = ServiceName.MangaDex;

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

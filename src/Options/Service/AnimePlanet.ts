import { Runtime } from '../../Core/Runtime';
import { Service, ActivableModule, LoginMethod, ActivableService, LoginModule } from './Service';
import { AnimePlanetTitle } from '../../Service/AnimePlanet';
import { DOM } from '../../Core/DOM';
import { TitleCollection, ServiceKeyType, ActivableName, ActivableKey, Title } from '../../Core/Title';
import { Mochi } from '../../Core/Mochi';
import { APIImportableModule } from './Import';
import { APIExportableModule } from './Export';

class AnimePlanetLogin extends LoginModule {
	username: string = '';
	token: string = '';

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.anime-planet.com/contact',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		// Find username
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const profileLink = body.querySelector('.loggedIn a[href^="/users/"]');
		if (profileLink !== null) {
			this.username = profileLink.getAttribute('title') ?? '';
			const token = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
			if (token !== null) this.token = token[1];
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
	};
}

class AnimePlanetActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.anime-planet.com/login';
}

class AnimePlanetImport extends APIImportableModule {
	parser: DOMParser = new DOMParser();

	// Set the list type to 'list'
	preMain = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Setting list type...' });
		const notification = this.notification('loading', [progress]);
		const username = (this.service as AnimePlanet).loginModule.username;
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/users/${username}/manga/reading?sort=title&mylist_view=list`,
			credentials: 'include',
		});
		notification.classList.remove('loading');
		DOM.append(progress, DOM.space(), DOM.text(' done !'));
		return response.ok;
	};

	/**
	 * Adding `per_page=560` result in a 302, we can't use that
	 */
	handlePage = async (): Promise<AnimePlanetTitle[] | false> => {
		const username = (this.service as AnimePlanet).loginModule.username;
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/users/${username}/manga?sort=title&page=${this.state.current}`,
			credentials: 'include',
		});
		if (!response.ok || typeof response.body !== 'string') {
			this.notification('warning', 'The request failed, maybe AnimePlanet is having problems, retry later.');
			return false;
		}
		let titles: AnimePlanetTitle[] = [];
		const body = this.parser.parseFromString(response.body, 'text/html');
		const rows = body.querySelectorAll('table.personalList tbody tr');
		for (const row of rows) {
			const name = row.querySelector('a.tooltip') as HTMLAnchorElement;
			const slug = /\/manga\/(.+)/.exec(name.href);
			if (slug) {
				const form = row.querySelector('form[data-id]') as HTMLSelectElement;
				const chapter = row.querySelector('select[name="chapters"]') as HTMLSelectElement;
				const volume = row.querySelector('select[name="volumes"]') as HTMLSelectElement;
				const status = row.querySelector('select.changeStatus') as HTMLSelectElement;
				// Score range: 0-5 with increments of 0.5
				const score = row.querySelector('div.starrating > div[name]') as HTMLElement;
				// TODO: Find Max Chapter
				titles.push(
					new AnimePlanetTitle(
						{
							s: slug[1],
							i: parseInt(form.dataset.id as string),
						},
						{
							progress: {
								chapter: parseInt(chapter.value as string),
								volume: parseInt(volume.value as string),
							},
							status: AnimePlanetTitle.toStatus(parseInt(status.value)),
							score: parseFloat(score.getAttribute('name') as string) * 20,
							name: name.textContent as string,
						}
					)
				);
			}
		}
		const navigation = body.querySelector('div.pagination > ul.nav');
		if (navigation !== null) {
			const last = navigation.lastElementChild?.previousElementSibling;
			if (last !== null && last !== undefined) {
				this.state.max = parseInt(last.textContent as string);
			}
		}
		return titles;
	};

	convertTitles = async (titles: TitleCollection, titleList: AnimePlanetTitle[]): Promise<number> => {
		const connections = await Mochi.findMany(
			titleList.map((t) => t.id.i),
			this.service.serviceName
		);
		const found: number[] = [];
		if (connections !== undefined) {
			for (const key in connections) {
				const connection = connections[key];
				if (connection['md'] !== undefined) {
					const title = titleList.find((t) => t.id.i == parseInt(key));
					if (title) {
						title.mangaDex = connection['md'];
						const convertedTitle = title.toLocalTitle();
						if (convertedTitle) {
							titles.add(convertedTitle);
							found.push(title.id.i);
						}
					}
				}
			}
		}
		// Find title that don't have a connection
		const noIds = titleList.filter((t) => found.indexOf(t.id.i) < 0);
		this.summary.failed.push(...noIds.filter((t) => t.name !== undefined).map((t) => t.name as string));
		return found.length;
	};
}

class AnimePlanetExport extends APIExportableModule {
	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = AnimePlanetTitle.fromLocalTitle(title);
		if (exportTitle && exportTitle.status !== Status.NONE) {
			(exportTitle as AnimePlanetTitle).token = (this.service as AnimePlanet).loginModule.token;
			const responseStatus = await exportTitle.persist();
			return responseStatus <= RequestStatus.CREATED;
		}
		return false;
	};
}

export class AnimePlanet extends Service implements ActivableService {
	static readonly serviceName: ActivableName = ActivableName.AnimePlanet;
	static readonly key: ActivableKey = ActivableKey.AnimePlanet;

	static link(id: ServiceKeyType): string {
		if (typeof id !== 'object') return '#';
		return AnimePlanetTitle.link(id);
	}

	loginModule: AnimePlanetLogin = new AnimePlanetLogin();
	activeModule: AnimePlanetActive = new AnimePlanetActive(this);
	importModule: AnimePlanetImport = new AnimePlanetImport(this);
	exportModule: AnimePlanetExport = new AnimePlanetExport(this);
}

import { Runtime, RequestStatus } from '../../src/Runtime';
import { Service, ActivableModule, APIImportableModule, LoginMethod, APIExportableModule } from './Service';
import { AnimePlanetTitle, AnimePlanetStatus } from '../../src/Service/AnimePlanet';
import { DOM } from '../../src/DOM';
import { Title, ServiceKey, ServiceName, TitleCollection } from '../../src/Title';
import { Mochi } from '../../src/Mochi';

class AnimePlanetActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.anime-planet.com/login';
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

class AnimePlanetImport extends APIImportableModule<AnimePlanetTitle> {
	parser: DOMParser = new DOMParser();

	// Set the list type to 'list'
	preMain = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Setting list type...' });
		const notification = this.notification('loading', [progress]);
		const username = (this.service as AnimePlanet).activeModule.username;
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
		const username = (this.service as AnimePlanet).activeModule.username;
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
				titles.push(
					new AnimePlanetTitle(slug[1], {
						api: parseInt(form.dataset.id as string),
						progress: {
							chapter: parseInt(chapter.value as string),
							volume: parseInt(volume.value as string),
						},
						status: parseInt(status.value),
						score: parseFloat(score.getAttribute('name') as string) * 20,
						name: name.textContent as string,
					})
				);
			}
		}
		const navigation = body.querySelector('div.pagination > ul.nav');
		if (navigation !== null) {
			const last = navigation.lastElementChild?.previousElementSibling;
			if (last !== null && last !== undefined) {
				this.state.max = 4; // parseInt(last.textContent as string);
			}
		}
		return titles;
	};

	convertTitles = async (titles: TitleCollection, titleList: AnimePlanetTitle[]): Promise<number> => {
		const connections = await Mochi.findMany(
			titleList.map((t) => t.api),
			this.service.name
		);
		const found: number[] = [];
		if (connections !== undefined) {
			for (const key in connections) {
				const connection = connections[key];
				if (connection[ServiceKey.MangaDex] !== undefined) {
					const title = titleList.find((t) => t.api == parseInt(key));
					if (title) {
						title.mangaDex = connection[ServiceKey.MangaDex];
						const convertedTitle = title.toTitle();
						if (convertedTitle) {
							titles.add(convertedTitle);
							found.push(title.api);
						}
					}
				}
			}
		}
		// Find title that don't have a connection
		const noIds = titleList.filter((t) => found.indexOf(t.api) < 0);
		this.summary.failed.push(...noIds.filter((t) => t.name !== undefined).map((t) => t.name as string));
		return found.length;
	};
}

class AnimePlanetExport extends APIExportableModule {
	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = AnimePlanetTitle.fromTitle(title);
		if (exportTitle && exportTitle.status !== AnimePlanetStatus.NONE) {
			exportTitle.token = (this.service as AnimePlanet).activeModule.token;
			const responseStatus = await exportTitle.persist();
			return responseStatus == RequestStatus.SUCCESS;
		}
		return false;
	};
}

export class AnimePlanet extends Service {
	readonly key: ServiceKey = ServiceKey.AnimePlanet;
	readonly name: ServiceName = ServiceName.AnimePlanet;

	activeModule: AnimePlanetActive = new AnimePlanetActive(this);
	importModule: AnimePlanetImport = new AnimePlanetImport(this);
	exportModule: AnimePlanetExport = new AnimePlanetExport(this);
}

import { RawResponse, Runtime, RequestStatus } from '../../src/Runtime';
import { Service, ActivableModule, APIImportableModule, LoginMethod, APIExportableModule } from './Service';
import { AnimePlanetTitle, AnimePlanetStatus } from '../../src/Service/AnimePlanet';
import { DOM } from '../../src/DOM';
import { Title } from '../../src/Title';
import { ServiceKey, ServiceName } from '../../src/core';

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
		if (response.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return RequestStatus.BAD_REQUEST;
		}
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

	login = undefined;
	logout = undefined;
}

class AnimePlanetImport extends APIImportableModule<AnimePlanetTitle> {
	parser: DOMParser = new DOMParser();
	convertManyTitles = undefined;

	// Set the list type to 'list'
	preMain = async (): Promise<boolean> => {
		const notification = this.notification('default', [
			DOM.text('Setting list type...'),
			DOM.space(),
			this.stopButton,
		]);
		const username = (this.service as AnimePlanet).activeModule.username;
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/users/${username}/manga/reading?sort=title&mylist_view=list`,
			credentials: 'include',
		});
		notification.classList.remove('loading');
		this.stopButton.remove();
		DOM.append(notification, DOM.text('done'));
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
		if (response.status >= 400 || typeof response.body !== 'string') {
			this.notification('warning', 'The request failed, maybe AnimePlanet is having problems, retry later.');
			return false;
		}
		let titles: AnimePlanetTitle[] = [];
		const body = this.parser.parseFromString(response.body, 'text/html');
		const rows = body.querySelectorAll('table.personalList tbody tr');
		for (const row of rows) {
			const name = row.querySelector('a.tooltip') as HTMLElement;
			const form = row.querySelector('form[data-id]') as HTMLSelectElement;
			const chapter = row.querySelector('select[name="chapters"]') as HTMLSelectElement;
			const volume = row.querySelector('select[name="volumes"]') as HTMLSelectElement;
			const status = row.querySelector('select.changeStatus') as HTMLSelectElement;
			const score = row.querySelector('div.starrating > div[name]') as HTMLElement;
			titles.push(
				new AnimePlanetTitle(parseInt(form.dataset.id as string), {
					progress: {
						chapter: parseInt(chapter.value as string),
						volume: parseInt(volume.value as string),
					},
					status: parseInt(status.value),
					score: parseInt(score.getAttribute('name') as string),
					name: name.textContent as string,
				})
			);
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
}

class AnimePlanetExport extends APIExportableModule {
	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = AnimePlanetTitle.fromTitle(title);
		if (exportTitle && exportTitle.status !== AnimePlanetStatus.NONE) {
			const responseStatus = await exportTitle.persist();
			return responseStatus == RequestStatus.SUCCESS;
		}
		return false;
	};
}

export class AnimePlanet extends Service {
	key: ServiceKey = ServiceKey.AnimePlanet;
	name: ServiceName = ServiceName.AnimePlanet;

	activeModule: AnimePlanetActive = new AnimePlanetActive(this);
	importModule: AnimePlanetImport = new AnimePlanetImport(this);
	exportModule: AnimePlanetExport = new AnimePlanetExport(this);
}

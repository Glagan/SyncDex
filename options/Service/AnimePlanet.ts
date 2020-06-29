import { RawResponse, Runtime, JSONResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Progress } from '../../src/interfaces';
import { ManageableService, ActivableModule, APIImportableModule, LoginMethod, APIExportableModule } from './Service';
import { Status, ServiceName } from '../../src/Service';
import { AnimePlanet as AnimePlanetService } from '../../src/Service/AnimePlanet';
import { DOM } from '../../src/DOM';

interface AnimePlanetTitle {
	id: number;
	status: Status;
	progress: Progress;
	score: number;
	name: string;
}

interface AnimePlanetResponse {
	id: number;
	type: 'manga';
	success: boolean;
	[key: string]: any;
}

class AnimePlanetActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.anime-planet.com/login';
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
		const username = (this.manager.service as AnimePlanetService).username;
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
		const username = (this.manager.service as AnimePlanetService).username;
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
			const apTitle = {
				progress: {
					chapter: parseInt(chapter.value as string),
					volume: parseInt(volume.value as string),
				},
				id: parseInt(form.dataset.id as string),
				status: this.manager.service.toStatus(parseInt(status.value)),
				name: name.textContent as string,
				score: parseInt(score.getAttribute('name') as string),
			};
			if (apTitle.status !== Status.NONE) {
				titles.push(apTitle);
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
			titleList.map((t) => t.id),
			this.manager.service.name
		);
		let total = 0;
		if (connections !== undefined) {
			for (const key in connections) {
				if (connections.hasOwnProperty(key)) {
					const connection = connections[key];
					if (connection['MangaDex'] !== undefined) {
						const id = parseInt(key);
						const title = titleList.find((t) => t.id == id) as AnimePlanetTitle;
						titles.add(
							new Title(connection['MangaDex'], {
								services: { ap: title.id },
								progress: title.progress,
								status: title.status,
								chapters: [],
								name: title.name,
								score: title.score,
							})
						);
						total++;
					}
				}
			}
		}
		return total;
	};
}

class AnimePlanetExport extends APIExportableModule {
	exportTitle = async (title: Title): Promise<boolean> => {
		const service = this.manager.service as AnimePlanetService;
		const id = title.services.ap as number;
		// Status
		let response = await Runtime.request<JSONResponse>({
			url: `https://www.anime-planet.com/api/list/status/manga/${id}/${this.manager.service.fromStatus(
				title.status
			)}/${service.token}`,
			isJson: true,
			credentials: 'include',
		});
		const body = response.body as AnimePlanetResponse;
		if (!response.ok || !body.success) return false;
		// Chapter progress
		if (title.progress.chapter > 0) {
			response = await Runtime.request<JSONResponse>({
				url: `https://www.anime-planet.com/api/list/update/manga/${id}/${title.progress.chapter}/0/${service.token}`,
				isJson: true,
				credentials: 'include',
			});
			const body = response.body as AnimePlanetResponse;
			if (!response.ok || !body.success) return false;
		}
		// Score
		if (title.score > 0) {
			response = await Runtime.request<JSONResponse>({
				url: `https://www.anime-planet.com/api/list/rate/manga/${id}/${title.progress.chapter}/${service.token}`,
				isJson: true,
				credentials: 'include',
			});
			if (!response.ok) return false;
		}
		return true;
	};
}

export class AnimePlanet extends ManageableService {
	service: AnimePlanetService = new AnimePlanetService();
	activeModule: AnimePlanetActive = new AnimePlanetActive(this);
	importModule: AnimePlanetImport = new AnimePlanetImport(this);
	exportModule: AnimePlanetExport = new AnimePlanetExport(this);
}

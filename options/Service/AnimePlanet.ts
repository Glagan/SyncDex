import { RawResponse, Runtime } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Progress } from '../../src/interfaces';
import { ManageableService, ActivableModule, APIImportableModule, LoginMethod, APIExportableModule } from './Service';
import { Status } from '../../src/Service/Service';
import { AnimePlanet as AnimePlanetService } from '../../src/Service/AnimePlanet';
import { DOM } from '../../src/DOM';

interface AnimePlanetTitle {
	id: number;
	status: Status;
	progress: Progress;
	score: number;
}

class AnimePlanetActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.anime-planet.com/login';
	login = undefined;
	logout = undefined;
}

class AnimePlanetImport extends APIImportableModule<AnimePlanetTitle> {
	parser: DOMParser = new DOMParser();

	// Set the list type to 'list'
	preMain = async (): Promise<boolean> => {
		const notification = this.notification('info loading', [
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
			this.notification('danger', 'The request failed, maybe AnimePlanet is having problems, retry later.');
			return false;
		}
		let titles: AnimePlanetTitle[] = [];
		const body = this.parser.parseFromString(response.body, 'text/html');
		const rows = body.querySelectorAll('table.personalList tbody tr');
		for (const row of rows) {
			const apTitle = {
				progress: {},
			} as AnimePlanetTitle;
			const form = row.querySelector('form[data-id]') as HTMLSelectElement;
			apTitle.id = parseInt(form.dataset.id as string);
			const chapter = row.querySelector('select[name="chapters"]') as HTMLSelectElement;
			apTitle.progress.chapter = parseInt(chapter.value as string);
			const volume = row.querySelector('select[name="volumes"]') as HTMLSelectElement;
			apTitle.progress.volume = parseInt(volume.value as string);
			const status = row.querySelector('select.changeStatus') as HTMLSelectElement;
			apTitle.status = this.manager.service.toStatus(parseInt(status.value));
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

	convertTitle = async (titles: TitleCollection, title: AnimePlanetTitle): Promise<boolean> => {
		const connections = await Mochi.find(title.id, 'AnimePlanet');
		if (connections !== undefined && connections['MangaDex'] !== undefined) {
			titles.add(
				new Title(connections['MangaDex'] as number, {
					services: { ap: title.id },
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

class AnimePlanetExport extends APIExportableModule {
	exportTitle = async (title: Title): Promise<boolean> => {
		const service = this.manager.service as AnimePlanetService;
		const id = title.services.ap as number;
		// Status
		let response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/api/list/status/manga/${id}/${this.manager.service.fromStatus(
				title.status
			)}/${service.token}`,
			credentials: 'include',
		});
		if (!response.ok) return false;
		// Chapter progress
		if (title.progress.chapter > 0) {
			response = await Runtime.request<RawResponse>({
				url: `https://www.anime-planet.com/api/list/update/manga/${id}/${title.progress.chapter}/0/${service.token}`,
				credentials: 'include',
			});
			if (!response.ok) return false;
		}
		// Score
		if (title.score > 0) {
			response = await Runtime.request<RawResponse>({
				url: `https://www.anime-planet.com/api/list/rate/manga/${id}/${title.progress.chapter}/${service.token}`,
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

import { RawResponse, Runtime } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Progress } from '../../src/interfaces';
import { ManageableService, ActivableModule, ExportableModule, APIImportableModule, LoginMethod } from './Service';
import { Status, LoginStatus } from '../../src/Service/Service';
import { AnimePlanet as AnimePlanetService } from '../../src/Service/AnimePlanet';

interface AnimePlanetTitle {
	id: string;
	status: Status;
	progress: Progress;
	// TODO: Add score, start and end
}

class AnimePlanetActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.anime-planet.com/login';
	login = undefined;
	logout = undefined;
}

class AnimePlanetImport extends APIImportableModule<AnimePlanetTitle> {
	parser: DOMParser = new DOMParser();

	/**
	 * Adding `per_page=560` result in a 302, we can't use that
	 */
	handlePage = async (): Promise<AnimePlanetTitle[] | false> => {
		const username = (this.manager.service as AnimePlanetService).username;
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/users/${username}/manga?sort=title&page=${this.state.current}&mylist_view=list`,
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
			const title = row.querySelector('a[href^="/manga/"]') as HTMLElement;
			apTitle.id = title.getAttribute('href')?.slice(7) as string;
			const chapter = row.querySelector('select[name="chapters"]') as HTMLSelectElement;
			apTitle.progress.chapter = parseInt(chapter.value as string);
			const volume = row.querySelector('select[name="volumes"]') as HTMLSelectElement;
			apTitle.progress.volume = parseInt(volume.value as string);
			const status = row.querySelector('select.changeStatus') as HTMLSelectElement;
			apTitle.status = this.manager.service.toStatus(status.value);
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

class AnimePlanetExport extends ExportableModule {
	export = async (): Promise<void> => {
		// 1: Load all titles with AnimePlanet ID
		// 2: Update entries one by one
	};
}

export class AnimePlanet extends ManageableService {
	service: AnimePlanetService = new AnimePlanetService();
	activeModule: ActivableModule = new AnimePlanetActive(this);
	importModule: APIImportableModule<AnimePlanetTitle> = new AnimePlanetImport(this);
	exportModule: ExportableModule = new AnimePlanetExport(this);
}

import { Progress } from '../../src/interfaces';
import { Status, ServiceName } from '../../src/Service/Service';
import { Runtime, RawResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import {
	ManageableService,
	ActivableModule,
	APIImportableModule,
	ImportStep,
	LoginMethod,
	APIExportableModule,
} from './Service';
import { MangaUpdates as MangaUpdatesService } from '../../src/Service/MangaUpdates';
import { DOM } from '../../src/DOM';

interface MangaUpdatesTitle {
	id: number;
	progress: Progress;
	status: Status;
	score?: number;
	name: string;
}

class MangaUpdatesActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.mangaupdates.com/login.html';
	login = undefined;
	logout = undefined;
}

class MangaUpdatesImport extends APIImportableModule<MangaUpdatesTitle> {
	needReference: boolean = false;
	parser: DOMParser = new DOMParser();
	currentPage: string = '';
	currentList: number = 0;
	static lists: string[] = ['read', 'wish', 'complete', 'unfinished', 'hold'];
	convertManyTitles = undefined;

	progressFromNode = (node: HTMLElement | null): number => {
		if (node !== null) {
			return parseInt((node.textContent as string).slice(2));
		}
		return 0;
	};

	toStatus = (list: string): Status => {
		if (list === 'read') {
			return Status.READING;
		} else if (list === 'wish') {
			return Status.PLAN_TO_READ;
		} else if (list === 'complete') {
			return Status.COMPLETED;
		} else if (list === 'unfinished') {
			return Status.DROPPED;
		} else if (list === 'hold') {
			return Status.PAUSED;
		}
		return Status.NONE;
	};

	getNextPage = (): boolean => {
		if (this.currentList == MangaUpdatesImport.lists.length) {
			return false;
		}
		this.currentPage = MangaUpdatesImport.lists[this.currentList++];
		return true;
	};

	getProgress = (step: ImportStep, total?: number): string => {
		if (step == ImportStep.FETCH_PAGES) {
			return `Importing list ${this.currentList} out of 5.`;
		}
		// ImportStep.CONVERT_TITLES
		this.currentTitle = Math.min(total as number, this.currentTitle + this.perConvert);
		return `Converting title ${this.currentTitle} out of ${total}.`;
	};

	handlePage = async (): Promise<MangaUpdatesTitle[] | false> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/mylist.html?list=${this.currentPage}`,
			credentials: 'include',
		});
		if (response.ok && response.body.indexOf('You must be a user to access this page.') < 0) {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll(`div[id^='r']`);
			const status = this.toStatus(MangaUpdatesImport.lists[this.currentList - 1]);
			let titles: MangaUpdatesTitle[] = [];
			for (const row of rows) {
				const scoreLink = row.querySelector(`a[title='Update Rating']`);
				let score: number | undefined;
				if (scoreLink !== null) {
					score = parseInt(scoreLink.textContent as string);
					if (isNaN(score)) score = undefined;
				}
				const name = row.querySelector(`a[title='Series Info']`) as HTMLElement;
				titles.push({
					id: parseInt(row.id.slice(1)),
					progress: {
						chapter: this.progressFromNode(row.querySelector(`a[title='Increment Chapter']`)),
						volume: this.progressFromNode(row.querySelector(`a[title='Increment Volume']`)),
					},
					status: status,
					score: score,
					name: name.textContent as string,
				});
			}
			return titles;
		}
		return false;
	};

	convertTitles = async (titles: TitleCollection, titleList: MangaUpdatesTitle[]): Promise<number> => {
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
						const title = titleList.find((t) => t.id == id) as MangaUpdatesTitle;
						titles.add(
							new Title(connection['MangaDex'] as number, {
								services: { mu: title.id },
								progress: title.progress,
								status: title.status,
								chapters: [],
								score: title.score,
								name: title.name,
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

class MangaUpdatesExport extends APIExportableModule {
	actual: MangaUpdatesTitle[] = [];

	findTitle = (id: number): MangaUpdatesTitle | undefined => {
		return this.actual.find((title) => title.id == id);
	};

	// We need the status of each titles before to move them from lists to lists
	// Use ImportModule and get a list of MangaUpdatesTitles
	preMain = async (_titles: Title[]): Promise<boolean> => {
		let notification = this.notification('info loading', [
			DOM.text('Checking current status of each titles'),
			DOM.space(),
			this.stopButton,
		]);
		const importModule = new MangaUpdatesImport(this.manager);
		while (!this.doStop && importModule.getNextPage() !== false) {
			let tmp: MangaUpdatesTitle[] | false = await importModule.handlePage();
			if (tmp === false) {
				this.stopButton.remove();
				notification.classList.remove('loading');
				return false;
			}
			this.actual.push(...tmp);
		}
		this.stopButton.remove();
		notification.classList.remove('loading');
		return true; // TODO: Also *Import* at the same time to just have the latest values ?
	};

	fromStatus = (status: Status): string => {
		if (status == Status.READING) {
			return 'read';
		} else if (status == Status.PLAN_TO_READ) {
			return 'wish';
		} else if (status == Status.COMPLETED) {
			return 'complete';
		} else if (status == Status.DROPPED) {
			return 'unfinished';
		} else if (status == Status.PAUSED) {
			return 'hold';
		}
		return '__invalid__';
	};

	delete = async (id: number, from: Status): Promise<void> => {
		await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/ajax/list_update.php?s=${id}&l=${this.fromStatus(from)}&r=1`,
			credentials: 'include',
		});
	};

	updateStatus = async (id: number, to: Status): Promise<void> => {
		if (to !== Status.NONE) {
			const status = this.fromStatus(to);
			await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/list_update.php?s=${id}&l=${status}`,
				method: 'GET',
				credentials: 'include',
			});
		}
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		const muTitle = this.findTitle(title.id);
		const id = title.services.mu as number;
		// Update status
		if (muTitle == undefined || muTitle.status != title.status) {
			// Status requirements
			let list = MangaUpdatesService.pathToStatus(muTitle?.status, title.status, muTitle !== undefined);
			for (const status of list) {
				if (status == Status.NONE) {
					this.delete(id, muTitle?.status as Status);
				} else await this.updateStatus(id, status);
			}
			// Real status
			await this.updateStatus(id, title.status);
		}
		// Update progress -- only if chapter or volume is different
		if (
			muTitle == undefined ||
			(muTitle != undefined &&
				((title.progress.chapter > 1 && title.progress.chapter != muTitle.progress.chapter) ||
					(title.progress.volume !== undefined &&
						title.progress.volume > 0 &&
						title.progress.volume != muTitle.progress.volume)))
		) {
			await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/chap_update.php?s=${id}&set_v=${title.progress.volume}&set_c=${title.progress.chapter}`,
				credentials: 'include',
			});
		}
		// Update score
		if ((muTitle != undefined && title.score != muTitle.score) || (muTitle == undefined && title.score > 0)) {
			await Runtime.request<RawResponse>({
				url: `https://www.mangaupdates.com/ajax/update_rating.php?s=${id}&r=${title.score}`,
				credentials: 'include',
			});
		}
		return true;
	};
}

export class MangaUpdates extends ManageableService {
	service: MangaUpdatesService = new MangaUpdatesService();
	activeModule: MangaUpdatesActive = new MangaUpdatesActive(this);
	importModule: MangaUpdatesImport = new MangaUpdatesImport(this);
	exportModule: MangaUpdatesExport = new MangaUpdatesExport(this);
}

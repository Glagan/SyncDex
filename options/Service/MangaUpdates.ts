import { DOM } from '../../src/DOM';
import { Progress } from '../../src/interfaces';
import { Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { Runtime, RawResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Service } from './Service';
import { ServiceName, ServiceManager } from '../Manager/Service';

interface MUTitle {
	id: number;
	progress: Progress;
	status: Status;
}

export class MangaUpdates extends Service {
	name: ServiceName = ServiceName.MangaUpdates;
	key: string = 'mu';
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.mangaupdates.com/login.html';
	parser: DOMParser = new DOMParser();
	static lists: string[] = ['read', 'wish', 'complete', 'unfinished', 'hold'];

	activable: boolean = true;
	importable: boolean = true;
	exportable: boolean = true;

	isLoggedIn = async <T>(reference?: T): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body &&
			response.body.indexOf(`You are currently logged in as`) >= 0
		)
			return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};

	login = undefined;
	logout = undefined;

	import = async (): Promise<void> => {
		const block = DOM.create('div', {
			class: 'block',
		});
		const startButton = DOM.create('button', {
			class: 'success mr-1',
			textContent: 'Start',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					this.handleImport();
				},
			},
		});
		DOM.append(this.manager.saveContainer, DOM.append(block, startButton, this.resetButton()));
	};

	getProgress = (node: HTMLElement | null): number => {
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

	listPage = async (titles: MUTitle[], list: string): Promise<boolean> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/mylist.html?list=${list}`,
			credentials: 'include',
		});
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body.indexOf('You must be a user to access this page.') < 0
		) {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll(`div[id^='r']`);
			const status = this.toStatus(list);
			for (const row of rows) {
				titles.push({
					id: parseInt(row.id.slice(1)),
					progress: {
						chapter: this.getProgress(row.querySelector(`a[title='Increment Chapter']`)),
						volume: this.getProgress(row.querySelector(`a[title='Increment Volume']`)),
					},
					status: status,
				});
			}
			return true;
		}
		return false;
	};

	handleImport = async (): Promise<void> => {
		this.manager.resetSaveContainer();
		this.manager.header('Importing from MangaUpdates');
		let muTitles: MUTitle[] = [];
		let doStop = false;
		const stopButton = this.stopButton(() => {
			doStop = true;
		});
		let notification = this.notification('info loading', [
			DOM.text(`Importing list 1 out of 5.`),
			DOM.space(),
			stopButton,
		]);
		for (let i = 0; i < MangaUpdates.lists.length; i++) {
			const listName = MangaUpdates.lists[i];
			(notification.firstChild as Text).textContent = `Importing list ${i + 1} out of 5.`;
			if (!(await this.listPage(muTitles, listName))) {
				this.notification(
					'danger',
					`The request failed, maybe MangaUpdates is having problems or you aren't logged in, retry later.`
				);
				break;
			}
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		// Find MangaDex IDs
		let titles = new TitleCollection();
		const total = muTitles.length;
		let added = 0;
		this.notification('success', `Found a total of ${muTitles.length} Titles.`);
		notification = this.notification('info loading', [
			DOM.text(`Finding MangaDex IDs from MangaUpdates IDs, 0 out of ${total}.`),
			DOM.space(),
			stopButton,
		]);
		let index = 0;
		for (const muTitle of muTitles) {
			const connections = await Mochi.find(muTitle.id, 'MangaUpdates');
			if (connections !== undefined && connections['MangaDex'] !== undefined) {
				titles.add(
					new Title(connections['MangaDex'] as number, {
						services: { mu: muTitle.id },
						progress: muTitle.progress,
						status: muTitle.status,
						chapters: [],
					})
				);
				added++;
			}
			notification.textContent = `Finding MangaDex IDs from MangaUpdates IDs, ${++index} out of ${total}.`;
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		// Done, merge and save
		titles.merge(await TitleCollection.get(titles.ids));
		await titles.save();
		this.notification('success', [
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from MangaUpdates.`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	export = async (): Promise<void> => {};
}

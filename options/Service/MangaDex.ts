import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Runtime, RawResponse } from '../../src/Runtime';
import { Status, LoginStatus } from '../../src/Service/Service';
import { ImportState, Service, ImportableModule, ExportableModule, ImportType } from './Service';
import { ServiceName } from '../Manager/Service';

class MangaDexImport extends ImportableModule {
	importType: ImportType = ImportType.LIST;
	parser: DOMParser = new DOMParser();
	form?: HTMLFormElement;
	convertOptions = undefined;
	fileToTitles = undefined;
	login = undefined;
	logout = undefined;

	isLoggedIn = async <T = { id: number }>(reference?: T): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/about`,
			credentials: 'include',
		});
		if (response.status >= 400) {
			this.notification('danger', 'The request failed, maybe MangaDex is having problems, retry later.');
			return LoginStatus.FAIL;
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
			if (reference) {
				(reference as any).id = parseInt(res[1]);
			}
			return LoginStatus.SUCCESS;
		} catch (error) {
			this.notification('danger', `Could not find your ID, are you sure you're logged in ?`);
			return LoginStatus.FAIL;
		}
	};

	import = async (): Promise<void> => {
		this.notification(
			'info',
			`Importing from MangaDex doesn't do much and only initialize your SyncDex save with "empty" titles since there is no progress saved on MangaDex.`
		);
		const block = DOM.create('div', {
			class: 'block',
		});
		let busy = false;
		const startButton = DOM.create('button', {
			class: 'success mr-1',
			textContent: 'Start',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					if (!busy) {
						busy = true;
						startButton.classList.add('loading');
						const userId: { id: number } = { id: 0 };
						const status = await this.isLoggedIn<{ id: number }>(userId);
						if (status == LoginStatus.SUCCESS) {
							await this.handleImport(userId.id);
						} else {
							startButton.classList.remove('loading');
						}
						busy = false;
					}
				},
			},
		});
		DOM.append(this.service.manager.saveContainer, DOM.append(block, startButton, this.resetButton()));
	};

	toStatus = (statusNode: HTMLElement | null): Status => {
		if (statusNode === null) return Status.NONE;
		const id = statusNode.getAttribute('id');
		if (id === '1') {
			return Status.READING;
		} else if (id === '2') {
			return Status.COMPLETED;
		} else if (id === '3') {
			return Status.PAUSED;
		} else if (id === '4') {
			return Status.PLAN_TO_READ;
		} else if (id === '5') {
			return Status.DROPPED;
		} else if (id === '6') {
			return Status.REREADING;
		}
		return Status.NONE;
	};

	singlePage = async (titles: TitleCollection, user: number, state: ImportState): Promise<boolean> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/list/${user}/0/2/${++state.current}`,
			credentials: 'include',
		});
		if (response.status >= 400 || typeof response.body !== 'string') {
			this.notification('danger', 'The request failed, maybe MangaDex is having problems, retry later.');
			return false;
		}
		if (response.body.indexOf(`You do not have permission to view this user's list.`) >= 0) {
			this.notification(
				'danger',
				'You do not have the required Permissions to view this list, check if you are logged in.'
			);
			return false;
		}
		const body = this.parser.parseFromString(response.body, 'text/html');
		// Each row has a data-id field
		const rows = body.querySelectorAll<HTMLElement>('.manga-entry');
		for (const row of rows) {
			const id = parseInt(row.dataset.id || '');
			const status: Status = this.toStatus(row.querySelector<HTMLElement>('.dropdown-menu > .disabled'));
			if (!isNaN(id)) {
				titles.add(
					new Title(id, {
						status: status,
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
					state.max = parseInt(regRes[1]);
				}
			}
		}
		return true;
	};

	handleImport = async (userId: number): Promise<void> => {
		let titles = new TitleCollection();
		// Check if everything is valid by getting the first page
		const state = {
			current: 0,
			max: 0,
		};
		if (!(await this.singlePage(titles, userId, state))) {
			return;
		}
		this.service.manager.resetSaveContainer();
		this.service.manager.header('Importing MangaDex Titles');
		// Then fetch remaining pages
		let res = true;
		let doStop = false;
		const stopButton = this.stopButton(() => {
			doStop = true;
		});
		let notification = this.notification('success loading', [
			DOM.text(`Importing page 1 out of ${state.max}.`),
			DOM.space(),
			stopButton,
		]);
		while (!doStop && state.current < state.max && res) {
			res = await this.singlePage(titles, userId, state);
			(notification.firstChild as Text).textContent = `Importing page ${state.current} out of ${state.max}.`;
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		if (!res) {
			this.notification('warning', `Page ${state.current} failed, but all previous pages were imported.`);
		}
		notification = this.notification('success loading', `Saving ${titles.length} Titles.`);
		// Save all Titles -- done
		titles.merge(await TitleCollection.get(titles.ids));
		await titles.save();
		notification.remove();
		this.notification('success', [
			DOM.text(`Successfully imported ${titles.length} titles !`),
			DOM.space(),
			this.resetButton(),
		]);
	};
}

class MangaDexExport extends ExportableModule {
	fromStatus = (status: Status): number => {
		switch (status) {
			case Status.NONE:
			case Status.WONT_READ:
				return 0;
			case Status.READING:
				return 1;
			case Status.COMPLETED:
				return 2;
			case Status.PAUSED:
				return 3;
			case Status.PLAN_TO_READ:
				return 4;
			case Status.DROPPED:
				return 5;
			case Status.REREADING:
				return 6;
		}
	};

	export = async (): Promise<void> => {
		let loading = this.notification('info loading', `Step 1: Loading your local Save`);
		const titles = await TitleCollection.get();
		loading.classList.remove('loading');
		let notification = this.notification(
			'info loading',
			`Step 2: Adding all Titles to your MangaDex List (0 out of ${titles.length}).
			This can take a long time if you have a lot of titles, be patient.`
		);
		let len = titles.collection.length,
			total = 0;
		let doStop = false;
		const stopButton = this.stopButton(() => {
			doStop = true;
		});
		let index = 0;
		for (const title of titles.collection) {
			if (doStop) break;
			const status = this.fromStatus(title.status);
			if (status > 0) {
				const response = await Runtime.request<RawResponse>({
					url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${
						title.id
					}&type=${status}&_=${Date.now()}`,
					credentials: 'include',
					headers: {
						'X-Requested-With': 'XMLHttpRequest',
					},
				});
				if (response.status >= 200 && response.status < 400) {
					total++;
				}
			}
			(notification.firstChild as Text).textContent = `Step 2: Adding all Titles to your MangaDex List (${++index} out of ${len}).
			This can take a long time if you have a lot of titles, be patient.`;
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.notification('warning', 'You canceled the Export.');
		}
		this.notification('success', [
			DOM.text(`Done ! ${total} Titles have been exported.`),
			DOM.space(),
			this.resetButton(),
		]);
	};
}

export class MangaDex extends Service {
	name: ServiceName = ServiceName.MangaDex;
	key: string = 'md';

	activeModule = undefined;
	importModule: ImportableModule = new MangaDexImport(this);
	exportModule: ExportableModule = new MangaDexExport(this);
}

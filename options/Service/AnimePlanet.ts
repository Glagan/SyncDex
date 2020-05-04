import { RawResponse, Runtime } from '../../src/Runtime';
import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Progress } from '../../src/interfaces';
import { Service, ImportState } from './Service';
import { Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { ServiceName, ServiceManager } from '../Manager/Service';

interface APTitle {
	id: string;
	status: Status;
	progress: Progress;
}

export class AnimePlanet extends Service {
	name: ServiceName = ServiceName.AnimePlanet;
	key: string = 'ap';
	parser: DOMParser = new DOMParser();
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://www.anime-planet.com/login.php';

	activable: boolean = true;
	importable: boolean = true;
	exportable: boolean = true;

	login = undefined;
	logout = undefined;

	isLoggedIn = async <T = { username: string }>(reference?: T): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/contact`,
			credentials: 'include',
		});
		if (response.status >= 400) {
			this.notification('danger', 'The request failed, maybe AnimePlanet is having problems, retry later.');
			return LoginStatus.FAIL;
		}
		try {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const profileLink = body.querySelector('.loggedIn a[href^="/users/"]');
			if (profileLink === null) {
				console.log();
				throw 'Could not find Profile link';
			}
			if (reference) {
				(reference as any).username = profileLink.getAttribute('title') ?? '';
			}
			return LoginStatus.SUCCESS;
		} catch (error) {
			this.notification('danger', `Could not find your Username, are you sure you're logged in ?`);
			return LoginStatus.FAIL;
		}
	};

	import = async (): Promise<void> => {
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
						const username: { username: string } = { username: '' };
						const status = await this.isLoggedIn(username);
						if (status == LoginStatus.SUCCESS && username.username !== '') {
							await this.handleImport(username.username);
						} else {
							startButton.classList.remove('loading');
						}
						busy = false;
					}
				},
			},
		});
		DOM.append(this.manager.saveContainer, DOM.append(block, startButton, this.resetButton()));
	};

	toStatus = (status: string): Status => {
		if (status === '1') {
			// Completed
			return Status.COMPLETED;
		} else if (status === '2') {
			// Reading
			return Status.READING;
		} else if (status === '3') {
			// Dropped
			return Status.DROPPED;
		} else if (status === '4') {
			// Plan to read
			return Status.PLAN_TO_READ;
		} else if (status === '5') {
			// On-hold
			return Status.PAUSED;
		} else if (status === '6') {
			// Won't read
			return Status.WONT_READ;
		}
		return Status.NONE;
	};

	singlePage = async (titles: APTitle[], username: string, state: ImportState): Promise<boolean> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/users/${username}/manga?sort=title&per_page=560&page=${++state.current}`,
			credentials: 'include',
		});
		if (response.status >= 400 || typeof response.body !== 'string') {
			this.notification('danger', 'The request failed, maybe AnimePlanet is having problems, retry later.');
			return false;
		}
		const body = this.parser.parseFromString(response.body, 'text/html');
		const rows = body.querySelectorAll('table.personalList tbody tr');
		for (const row of rows) {
			const apTitle = {
				progress: {},
			} as APTitle;
			const title = row.querySelector('a[href^="/manga/"]') as HTMLElement;
			apTitle.id = title.getAttribute('href')?.slice(7) as string;
			const chapter = row.querySelector('select[name="chapters"]') as HTMLSelectElement;
			apTitle.progress.chapter = parseInt(chapter.value as string);
			const volume = row.querySelector('select[name="volumes"]') as HTMLSelectElement;
			apTitle.progress.volume = parseInt(volume.value as string);
			const status = row.querySelector('select.changeStatus') as HTMLSelectElement;
			apTitle.status = this.toStatus(status.value);
			if (apTitle.status !== Status.NONE) {
				titles.push(apTitle);
			}
		}
		// Next page: TODO, test if there is more than 2 pages...
		const navigation = body.querySelector('div.pagination > ul.nav');
		if (navigation !== null) {
			const last = navigation.lastElementChild?.previousElementSibling;
			if (last !== null && last !== undefined) {
				state.max = parseInt(last.textContent as string);
			}
		}
		return true;
	};

	handleImport = async (username: string): Promise<void> => {
		this.manager.resetSaveContainer();
		this.manager.header('Importing from AnimePlanet');
		let apTitles: APTitle[] = [];
		const state = {
			current: 0,
			max: 1,
		};
		let doStop = false;
		const stopButton = this.stopButton(() => {
			doStop = true;
		});
		let notification = this.notification('info loading', [
			DOM.text(`Importing page 1 of your list.`),
			DOM.space(),
			stopButton,
		]);
		while (!doStop && state.current < state.max) {
			await this.singlePage(apTitles, username, state);
			(notification.firstChild as Text).textContent = `Importing page ${state.current} out of ${state.max} of your list.`;
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		// Find MangaDex IDs
		let titles = new TitleCollection();
		const total = apTitles.length;
		let added = 0;
		this.notification('success', `Found a total of ${apTitles.length} Titles.`);
		notification = this.notification('info loading', [
			DOM.text(`Finding MangaDex IDs from AnimePlanet IDs, 0 out of ${total}.`),
			DOM.space(),
			stopButton,
		]);
		let index = 0;
		for (const apTitle of apTitles) {
			if (doStop) break;
			const connections = await Mochi.find(apTitle.id, 'AnimePlanet');
			if (connections !== undefined && connections['MangaDex'] !== undefined) {
				titles.add(
					new Title(connections['MangaDex'] as number, {
						services: { ap: apTitle.id },
						progress: apTitle.progress,
						status: apTitle.status,
						chapters: [],
					})
				);
				added++;
			}
			(notification.firstChild as Text).textContent = `Finding MangaDex IDs from AnimePlanet IDs, ${++index} out of ${total}.`;
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
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from AnimePlanet.`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	export = async (): Promise<void> => {};
}

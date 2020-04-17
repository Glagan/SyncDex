import { ServiceSave, Input } from './Save';
import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Runtime, RawResponse } from '../../src/Runtime';
import { Status } from '../../src/Service/Service';

interface ImportState {
	current: number;
	max: number;
}

export class MangaDex extends ServiceSave {
	name: string = 'MangaDex';
	key: string = 'md';

	parser: DOMParser = new DOMParser();
	form?: HTMLFormElement;

	// TODO: Cancel button
	import = (): void => {
		this.manager.clear();
		this.manager.header('Enter your MangaDex User ID');
		this.notification(
			'info',
			`Importing from MangaDex doesn't do much and only initialize your SyncDex save with "empty" titles since there is no progress saved on MangaDex.`
		);
		this.notification('info', [
			DOM.create('b', { textContent: 'MangaDex User ID' }),
			DOM.text(' in the form below, you can find it in your Profile.'),
			DOM.create('br'),
			DOM.text('You can click the Find button to add your ID if you are logged in.'),
		]);
		const inputRow = new Input('userId', 'MangaDex User ID', 'number');
		this.form = this.createForm([inputRow], (event) => this.handle(event));
		let busy = false;
		const find = DOM.create('button', {
			class: 'default ml-1',
			textContent: 'Find',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					if (!busy) {
						busy = true;
						find.classList.add('loading');
						const response = await Runtime.request<RawResponse>({
							// TODO: Find URL with User ID easily accessible inside
							url: `https://mangadex.org/user`,
							credentials: 'include',
						});
						if (response.status >= 400 || typeof response.body !== 'string') {
							this.error(
								'The request failed, maybe MangaDex is having problems, retry later.'
							);
						} else if (this.form) {
							const id = 0; // TODO: Find ID in the page
							this.form.userId.value = id.toString();
						}
						busy = false;
						find.classList.remove('loading');
					}
				},
			},
		});
		inputRow.node.appendChild(find);
	};

	singlePage = async (
		titles: TitleCollection,
		user: number,
		state: ImportState
	): Promise<boolean> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/list/${user}/0/2/${++state.current}`,
			credentials: 'include',
		});
		if (response.status >= 400 || typeof response.body !== 'string') {
			this.error('The request failed, maybe MangaDex is having problems, retry later.');
			return false;
		}
		if (response.body.indexOf(`You do not have permission to view this user's list.`) >= 0) {
			this.error(
				'You do not have the required Permissions to view this list, check if you entered the correct ID and that you are logged in.'
			);
			return false;
		}
		const body = this.parser.parseFromString(response.body, 'text/html');
		// Each row has a data-id field
		const rows = body.querySelectorAll('.manga-entry');
		for (let index = 0, len = rows.length; index < len; index++) {
			const id = parseInt((rows[index] as HTMLElement).dataset.id || '');
			if (!isNaN(id)) {
				titles.add(new Title(id));
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

	handle = async (event: Event): Promise<void> => {
		event.preventDefault();
		this.removeNotifications();
		if (!this.form) return;
		const userId = parseInt(this.form?.userId.value);
		if (isNaN(userId)) {
			this.error('Invalid User ID');
			return;
		}
		let titles = new TitleCollection();
		// Check if everything is valid by getting the first page
		const state = {
			current: 0,
			max: 0,
		};
		if (!(await this.singlePage(titles, userId, state))) {
			return;
		}
		// Then fetch remaining pages
		let res = true;
		while (state.current < state.max && res) {
			res = await this.singlePage(titles, userId, state);
		}
		if (!res) {
			this.notification(
				'warning',
				`Page ${state.current} failed, but all previous pages were imported.`
			);
		}
		// Save all Titles -- done
		await titles.save(); // TODO: Add only if titles aren't already saved
		this.success([
			DOM.text(`Successfully imported ${titles.length} titles !`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	statusToMangaDex = (status: Status): number => {
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

	// TODO: Cancel button
	export = async (): Promise<void> => {
		this.manager.clear();
		this.manager.header('Exporting to MangaDex');
		let loading = this.notification('info loading', `Step 1: Loading your local Save`);
		const titles = await TitleCollection.get();
		loading.classList.remove('loading');
		let notification = this.notification(
			'info loading',
			`Step 2: Adding all Titles to your MangaDex List (0 out of ${titles.length}).
			This can take a long time if you have a lot of titles, be patient.`
		);
		let index = 0,
			len = titles.collection.length;
		for (; index < len; index++) {
			const title = titles.collection[index];
			const status = this.statusToMangaDex(title.status);
			if (status > 0) {
				const response = await Runtime.request<RawResponse>({
					url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${title.id}&type=${status}`,
					credentials: 'include',
				});
				if (response.status >= 400) {
					break;
				}
			}
			notification.textContent = `Step 2: Adding all Titles to your MangaDex List (${
				index + 1
			} out of ${len}).
			This can take a long time if you have a lot of titles, be patient.`;
		}
		notification.classList.remove('loading');
		if (index == len) {
			this.success([
				DOM.text('Step 3: Done ! All of your Titles have been exported.'),
				DOM.space(),
				this.resetButton(),
			]);
		} else {
			this.error([
				DOM.text('The request failed, maybe MangaDex is having problem, retry later.'),
				DOM.space(),
				this.resetButton(),
			]);
		}
	};
}

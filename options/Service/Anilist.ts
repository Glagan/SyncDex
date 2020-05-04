import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { ServiceName, Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Service } from './Service';
import { ServiceManager } from '../Manager/Service';

interface ViewerResponse {
	data: {
		Viewer: {
			name: string;
		};
	};
}

enum AnilistStatus {
	'CURRENT' = 'CURRENT',
	'COMPLETED' = 'COMPLETED',
	'PLANNING' = 'PLANNING',
	'DROPPED' = 'DROPPED',
	'PAUSED' = 'PAUSED',
	'REPEATING' = 'REPEATING',
}

interface AnilistEntry {
	mediaId: number;
	status: AnilistStatus;
	progress: number;
	progressVolumes: number;
}

interface AnilistList {
	name: string;
	entries: AnilistEntry[];
}

interface AnilistResponse {
	data: {
		MediaListCollection: {
			lists: AnilistList[];
		};
	};
}

export class Anilist extends Service {
	name: ServiceName = ServiceName.Anilist;
	key: string = 'al';
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';

	activable: boolean = true;
	importable: boolean = true;
	exportable: boolean = true;
	form?: HTMLFormElement;

	static viewerQuery = `
		query {
			Viewer {
				name
			}
		}`;

	static listQuery = `
		query ($userId: Int, $userName: String) {
			MediaListCollection(userId: $userId, userName: $userName, type: MANGA) {
				lists {
					entries {
						mediaId
						status
						progress
						progressVolumes
					}
				}
			}
		}`; // Require $userName

	isLoggedIn = async <T>(reference?: T): Promise<LoginStatus> => {
		if (!Options.tokens.anilistToken === undefined) return LoginStatus.MISSING_TOKEN;
		const query = `query { Viewer { id } }`;
		const response = await Runtime.request<JSONResponse>({
			method: 'POST',
			url: 'https://graphql.anilist.co',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.anilistToken}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({ query: query }),
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
	};

	login = undefined;
	logout = undefined;

	createTitle = (): HTMLElement => {
		return DOM.create('span', {
			class: this.name.toLowerCase(),
			textContent: 'Ani',
			childs: [
				DOM.create('span', {
					class: 'list',
					textContent: 'List',
				}),
			],
		});
	};

	import = async (): Promise<void> => {
		this.notification('warning', `You need to have Anilist activated and to be logged in to import.`);
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
					if (
						Options.services.indexOf(ServiceName.Anilist) < 0 ||
						Options.tokens.anilistToken === undefined
					) {
						this.notification(
							'danger',
							'You need to have Anilist activated and to be logged in to Import.'
						);
						return;
					}
					if (!busy) {
						busy = true;
						startButton.classList.add('loading');
						const response = await Runtime.request<JSONResponse>({
							url: 'https://graphql.anilist.co/',
							method: 'POST',
							isJson: true,
							headers: {
								Accept: 'application/json',
								'Content-Type': 'application/json',
								Authorization: `Bearer ${Options.tokens.anilistToken}`,
							},
							body: JSON.stringify({
								query: Anilist.viewerQuery,
							}),
						});
						let username = '';
						if (response.status >= 400) {
							this.notification(
								'danger',
								`The request failed, maybe Anilist is having problems or your token expired, retry later.`
							);
							startButton.classList.remove('loading');
						} else {
							username = (response.body as ViewerResponse).data.Viewer.name;
							await this.handleImport(username);
						}
						busy = false;
					}
				},
			},
		});
		DOM.append(this.manager.saveContainer, DOM.append(block, startButton, this.resetButton()));
	};

	toStatus = (status: AnilistStatus): Status => {
		if (status == 'CURRENT') {
			return Status.READING;
		} else if (status == 'COMPLETED') {
			return Status.COMPLETED;
		} else if (status == 'PLANNING') {
			return Status.PLAN_TO_READ;
		} else if (status == 'DROPPED') {
			return Status.DROPPED;
		} else if (status == 'PAUSED') {
			return Status.PAUSED;
		} else if (status == 'REPEATING') {
			return Status.REREADING;
		}
		return Status.NONE;
	};

	handleImport = async (username: string): Promise<void> => {
		// Send a simple query to Anilist
		let notification = this.notification('info loading', 'Importing Manga list form Anilist...');
		const response = await Runtime.request<JSONResponse>({
			url: 'https://graphql.anilist.co/',
			method: 'POST',
			isJson: true,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: Anilist.listQuery,
				variables: {
					userName: username,
				},
			}),
		});
		notification.remove();
		if (response.status >= 500) {
			this.notification('danger', 'The request failed, maybe Anilist is having problems, retry later.');
			return;
		}
		if (response.status >= 400) {
			this.notification('danger', 'Bad Request, check if your token is valid.');
			return;
		}
		// data.MediaListCollection.lists[]
		let titles = new TitleCollection();
		const body = response.body as AnilistResponse;
		let total = body.data.MediaListCollection.lists.reduce((acc, list) => acc + list.entries.length, 0);
		let processed = 0;
		let added = 0;
		this.manager.resetSaveContainer();
		this.manager.header('Importing from Anilist');
		let doStop = false;
		const stopButton = this.stopButton(() => {
			doStop = true;
		});
		notification = this.notification('success loading', [
			DOM.text(`Finding MangaDex IDs from Anilist IDs, 0 out of ${total}.`),
			DOM.space(),
			stopButton,
		]);
		// Flatten entries and search MangaDex IDs
		for (const list of body.data.MediaListCollection.lists) {
			for (const entry of list.entries) {
				const connections = await Mochi.find(entry.mediaId, 'Anilist');
				if (connections !== undefined && connections['MangaDex'] !== undefined) {
					titles.add(
						new Title(connections['MangaDex'] as number, {
							services: { al: entry.mediaId },
							progress: {
								chapter: entry.progress,
								volume: entry.progressVolumes,
							},
							status: this.toStatus(entry.status),
							chapters: [],
						})
					);
					added++;
				}
				processed++;
				(notification.firstChild as Text).textContent = `Finding MangaDex IDs from Anilist IDs, ${processed} out of ${total}.`;
			}
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
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from Anilist.`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	export = async (): Promise<void> => {};
}

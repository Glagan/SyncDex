import { ServiceSave, Input } from './Save';
import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { ServiceName, Status } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';

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

export class Anilist extends ServiceSave {
	name: string = 'Anilist';
	key: string = 'al';

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

	// TODO: Cancel button
	import = (): void => {
		this.manager.clear();
		this.manager.header('Importing from Anilist');
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
						this.error('You need to have Anilist activated and to be logged in to Import.');
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
							this.error(
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
		DOM.append(this.manager.node, DOM.append(block, startButton, this.resetButton()));
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
		this.removeNotifications();
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
			this.error('The request failed, maybe Anilist is having problems, retry later.');
			return;
		}
		if (response.status >= 400) {
			this.error('Bad Request, check if your token is valid.');
			return;
		}
		// data.MediaListCollection.lists[]
		let titles = new TitleCollection();
		const body = response.body as AnilistResponse;
		let total = body.data.MediaListCollection.lists.reduce((acc, list) => acc + list.entries.length, 0);
		let processed = 0;
		let added = 0;
		this.manager.clear();
		this.manager.header('Importing from Anilist');
		notification = this.notification(
			'success loading',
			`Finding MangaDex IDs from Anilist IDs, 0 out of ${total}.`
		);
		// Flatten entries and search MangaDex IDs
		for (let lid = 0, len = body.data.MediaListCollection.lists.length; lid < len; lid++) {
			const list = body.data.MediaListCollection.lists[lid];
			for (let eid = 0, len = list.entries.length; eid < len; eid++) {
				const entry = list.entries[eid];
				const connections = await Mochi.find(entry.mediaId, 'Anilist');
				if (connections !== undefined) {
					for (let index = 0, len = connections.length; index < len; index++) {
						const connection = connections[index];
						if (connection.service === 'MangaDex') {
							titles.add(
								new Title(connection.id as number, {
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
							break;
						}
					}
				}
				processed++;
				notification.textContent = `Finding MangaDex IDs from Anilist IDs, ${processed} out of ${total}.`;
			}
		}
		// Done, merge and save
		notification.classList.remove('loading');
		titles.merge(await TitleCollection.get(titles.ids));
		await titles.save();
		this.success([
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from Anilist.`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	export = (): void => {};
}

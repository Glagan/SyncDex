import { ServiceSave, Input } from './Save';
import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { ServiceName, Status } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';

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
		this.manager.header('Enter your Anilist Username');
		this.notification(
			'info',
			`Make sure your lists are public and/or activate the Service to be logged in.`
		);
		const inputRow = new Input('username', 'Anilist Username', 'text');
		this.form = this.createForm([inputRow], (event) => this.handle(event));
		// Add a button to *Find* Username if the Service is activated
		let busy = false;
		const find = DOM.create('button', {
			class: 'default ml-1',
			textContent: 'Find',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					if (Options.services.indexOf(ServiceName.Anilist) < 0) {
						this.error('You need to have Anilist activated to find your Username.');
						return;
					}
					if (!busy) {
						busy = true;
						find.classList.add('loading');
						// TODO: Request to Anilist to find Username
						busy = false;
						find.classList.remove('loading');
					}
				},
			},
		});
		inputRow.node.appendChild(find);
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

	handle = async (event: Event): Promise<void> => {
		event.preventDefault();
		if (!this.form) return;
		const username = this.form?.username?.value.trim();
		if (username === undefined || username === '') {
			this.error('Empty Username');
			return;
		}
		// Send a simple query to Anilist
		let notification = this.notification('info loading', 'Sending request to Anilist...');
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
			this.error('Bad Request, check if you entered the correct Username.');
			return;
		}
		// data.MediaListCollection.lists[]
		let titles = new TitleCollection();
		const body = response.body as AnilistResponse;
		let total = body.data.MediaListCollection.lists.reduce(
			(acc, list) => acc + list.entries.length,
			0
		);
		let processed = 0;
		let added = 0;
		this.manager.clear();
		notification = this.notification(
			'success loading',
			`Finding MangaDex IDs from MyAnimeList IDs, 0 out of ${total}.`
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
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from Anilist`),
			DOM.space(),
			this.resetButton(),
		]);
		console.log(titles.collection);
	};

	export = (): void => {};
}

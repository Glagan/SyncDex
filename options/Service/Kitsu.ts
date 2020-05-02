import { ServiceSave, ImportState } from './Save';
import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { ServiceName, Status } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { Mochi } from '../../src/Mochi';
import { TitleCollection, Title } from '../../src/Title';

enum KitsuStatus {
	'current' = 'current',
	'completed' = 'completed',
	'planned' = 'planned',
	'on_hold' = 'on_hold',
	'dropped' = 'dropped',
}

interface KitsuManga {
	id: string;
	type: 'manga';
	links: any;
}

interface KitsuResponse {
	data: {
		id: string;
		type: string;
		links: any;
		attributes: {
			status: KitsuStatus;
			progress: number;
			volumesOwned: number;
		};
		relationships: {
			manga: {
				links: any;
				data: {
					type: 'manga';
					id: string;
				};
			};
		};
	}[];
	included: KitsuManga[];
	meta: {
		statusCounts: {
			current?: number;
			planned?: number;
			completed?: number;
			onHold?: number;
			dropped?: number;
		};
		count: number;
	};
	links: any;
}

interface KitsuTitle {
	id: number;
	status: Status;
	chapter: number;
	volume: number;
}

export class Kitsu extends ServiceSave {
	name: string = 'Kitsu';
	key: string = 'ku';

	toStatus = (status: KitsuStatus): Status => {
		if (status === 'current') {
			return Status.READING;
		} else if (status === 'completed') {
			return Status.COMPLETED;
		} else if (status === 'planned') {
			return Status.PLAN_TO_READ;
		} else if (status === 'on_hold') {
			return Status.PAUSED;
		} else if (status === 'dropped') {
			return Status.DROPPED;
		}
		return Status.NONE;
	};

	singlePage = async (titles: KitsuTitle[], state: ImportState): Promise<boolean> => {
		const response = await Runtime.request<JSONResponse>({
			url: `https://kitsu.io/api/edge/library-entries?filter[user_id]=${Options.tokens.kitsuUser}&
							filter[kind]=manga&
							fields[libraryEntries]=status,progress,volumesOwned,manga&
							include=manga&
							fields[manga]=id&
							page[limit]=500&
							page[offset]=${state.current++ * 500}`,
			isJson: true,
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/vnd.api+json',
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
			},
		});
		if (response.status >= 400) {
			this.error('The request failed, maybe Kitsu is having problems, retry later.');
			return false;
		}
		if (response.body.errors !== undefined) {
			this.error('The Request failed, check if you are logged in and your token is valid or retry later.');
			return false;
		}
		const body = response.body as KitsuResponse;
		// Each row has a data-id field
		for (const title of body.data) {
			const kitsuTitle: KitsuTitle = {
				id: parseInt(title.relationships.manga.data.id),
				chapter: title.attributes.progress,
				volume: title.attributes.volumesOwned,
				status: this.toStatus(title.attributes.status),
			};
			if (kitsuTitle.status !== Status.NONE) {
				titles.push(kitsuTitle);
			}
		}
		// We get 500 entries per page
		state.max = Math.floor(body.meta.count / 500);
		return true;
	};

	// TODO: Cancel button
	import = async (): Promise<void> => {
		this.manager.clear();
		this.manager.header('Importing from Kitsu');
		this.notification('warning', `You need to have Kitsu activated and to be logged in to import.`);
		const block = DOM.create('div', {
			class: 'block',
		});
		const startButton = DOM.create('button', {
			class: 'success mr-1',
			textContent: 'Start',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					if (
						Options.services.indexOf(ServiceName.Kitsu) < 0 ||
						Options.tokens.kitsuUser === undefined ||
						Options.tokens.kitsuToken === undefined
					) {
						this.error('You need to have Kitsu activated and to be logged in to Import.');
						return;
					}
					await this.handleImport();
				},
			},
		});
		DOM.append(this.manager.node, DOM.append(block, startButton, this.resetButton()));
	};

	handleImport = async (): Promise<void> => {
		this.manager.clear();
		this.removeNotifications();
		this.manager.header('Importing from Kitsu');
		// Check if everything is valid by getting the first page
		let kitsuTitles: KitsuTitle[] = [];
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
			(notification.firstChild as Text).textContent = `Importing page ${state.current + 1} out of ${
				state.max
			} of your list.`;
			await this.singlePage(kitsuTitles, state);
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.success([DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		// Find MangaDex IDs
		let titles = new TitleCollection();
		const total = kitsuTitles.length;
		let added = 0;
		this.notification('success', `Found a total of ${kitsuTitles.length} Titles.`);
		notification = this.notification('info loading', [
			DOM.text(`Finding MangaDex IDs from Kitsu IDs, 0 out of ${total}.`),
			DOM.space(),
			stopButton,
		]);
		let index = 0;
		for (const kitsuTitle of kitsuTitles) {
			const connections = await Mochi.find(kitsuTitle.id, 'Kitsu');
			if (connections !== undefined && connections['MangaDex'] !== undefined) {
				titles.add(
					new Title(connections['MangaDex'] as number, {
						services: { ku: kitsuTitle.id },
						progress: {
							chapter: kitsuTitle.chapter,
							volume: kitsuTitle.volume,
						},
						status: kitsuTitle.status,
						chapters: [],
					})
				);
				added++;
			}
			(notification.firstChild as Text).textContent = `Finding MangaDex IDs from Kitsu IDs, ${++index} out of ${total}.`;
		}
		notification.classList.remove('loading');
		stopButton.remove();
		if (doStop) {
			this.success([DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		// Done, merge and save
		titles.merge(await TitleCollection.get(titles.ids));
		await titles.save();
		this.success([
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from Kitsu.`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	export = (): void => {};
}

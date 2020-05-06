import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { ServiceName, Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { Mochi } from '../../src/Mochi';
import { TitleCollection, Title } from '../../src/Title';
import { ImportState, Service, ActivableModule, ImportableModule, ExportableModule, ImportType } from './Service';

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

class KitsuActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.FORM;

	isLoggedIn = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuUser === undefined || !Options.tokens.kitsuToken) return LoginStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
			},
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
	};

	getUserId = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuToken === undefined) return LoginStatus.MISSING_TOKEN;
		let data = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			method: 'GET',
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/vnd.api+json',
			},
		});
		if (data.status >= 200 && data.status < 400) {
			Options.tokens.kitsuUser = data.body.data[0].id;
			return LoginStatus.SUCCESS;
		} else if (data.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		}
		return LoginStatus.BAD_REQUEST;
	};

	login = async (username: string, password: string): Promise<LoginStatus> => {
		let data = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/oauth/token',
			isJson: true,
			method: 'POST',
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(
				password
			)}`,
		});
		if (data.status == 200) {
			Options.tokens.kitsuToken = data.body.access_token;
			const userIdResp = await this.getUserId();
			await Options.save();
			if (userIdResp !== LoginStatus.SUCCESS) return userIdResp;
			return LoginStatus.SUCCESS;
		} else if (data.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		}
		return LoginStatus.BAD_REQUEST;
	};

	logout = async (): Promise<void> => {
		delete Options.tokens.kitsuToken;
		delete Options.tokens.kitsuUser;
		return await Options.save();
	};
}

class KitsuImport extends ImportableModule {
	importType: ImportType = ImportType.LIST;
	convertOptions = undefined;
	fileToTitles = undefined;

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
			this.notification('danger', 'The request failed, maybe Kitsu is having problems, retry later.');
			return false;
		}
		if (response.body.errors !== undefined) {
			this.notification(
				'danger',
				'The Request failed, check if you are logged in and your token is valid or retry later.'
			);
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

	import = async (): Promise<void> => {
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
						this.notification('danger', 'You need to have Kitsu activated and to be logged in to Import.');
						return;
					}
					await this.handleImport();
				},
			},
		});
		DOM.append(this.service.manager.saveContainer, DOM.append(block, startButton, this.resetButton()));
	};

	handleImport = async (): Promise<void> => {
		this.service.manager.resetSaveContainer();
		this.service.manager.header('Importing from Kitsu');
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
			this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
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
			this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
			return;
		}
		// Done, merge and save
		titles.merge(await TitleCollection.get(titles.ids));
		await titles.save();
		this.notification('success', [
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from Kitsu.`),
			DOM.space(),
			this.resetButton(),
		]);
	};
}

class KitsuExport extends ExportableModule {
	export = async (): Promise<void> => {};
}

export class Kitsu extends Service {
	name: ServiceName = ServiceName.Kitsu;
	key: string = 'ku';

	activeModule: ActivableModule = new KitsuActive(this);
	importModule: ImportableModule = new KitsuImport(this);
	exportModule: ExportableModule = new KitsuExport(this);
}

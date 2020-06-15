import { Options } from '../../src/Options';
import { Status, LoginStatus } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { Mochi } from '../../src/Mochi';
import { TitleCollection, Title } from '../../src/Title';
import {
	ManageableService,
	ActivableModule,
	ExportableModule,
	APIImportableModule,
	LoginMethod,
	APIExportableModule,
} from './Service';
import { Kitsu as KitsuService, KitsuStatus } from '../../src/Service/Kitsu';
import { DOM } from '../../src/DOM';

interface EntryAttributes {
	status: KitsuStatus;
	progress: number;
	volumesOwned: number;
	ratingTwenty: number;
	startedAt: string | null;
	finishedAt: string | null;
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
		attributes: EntryAttributes;
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
	score: number;
	start: string | null;
	end: string | null;
}

class KitsuActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.FORM;

	getUserId = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuToken === undefined) return LoginStatus.MISSING_TOKEN;
		let data = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			method: 'GET',
			headers: KitsuService.LoggedHeaders(),
		});
		if (data.ok) {
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

class KitsuImport extends APIImportableModule<KitsuTitle> {
	handlePage = async (): Promise<KitsuTitle[] | false> => {
		const response = await Runtime.request<JSONResponse>({
			url: `https://kitsu.io/api/edge/library-entries?
					filter[user_id]=${Options.tokens.kitsuUser}&
					filter[kind]=manga&
					fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,startedAt,finishedAt,manga&
					include=manga&
					fields[manga]=id&
					page[limit]=500&
					page[offset]=${(this.state.current - 1) * 500}`,
			isJson: true,
			headers: KitsuService.LoggedHeaders(),
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
		let titles: KitsuTitle[] = [];
		const body = response.body as KitsuResponse;
		// Each row has a data-id field
		for (const title of body.data) {
			const kitsuTitle: KitsuTitle = {
				id: parseInt(title.relationships.manga.data.id),
				chapter: title.attributes.progress,
				volume: title.attributes.volumesOwned,
				status: this.manager.service.toStatus(title.attributes.status),
				score: title.attributes.ratingTwenty,
				start: title.attributes.startedAt,
				end: title.attributes.finishedAt,
			};
			if (kitsuTitle.status !== Status.NONE) {
				titles.push(kitsuTitle);
			}
		}
		// We get 500 entries per page
		this.state.max = Math.floor(body.meta.count / 500);
		return titles;
	};

	convertTitle = async (titles: TitleCollection, title: KitsuTitle): Promise<boolean> => {
		const connections = await Mochi.find(title.id, 'Kitsu');
		if (connections !== undefined && connections['MangaDex'] !== undefined) {
			titles.add(
				new Title(connections['MangaDex'] as number, {
					services: { ku: title.id },
					progress: {
						chapter: title.chapter,
						volume: title.volume,
					},
					status: title.status,
					chapters: [],
					score: title.score,
					start: title.start ? new Date(title.start).getTime() : undefined,
					end: title.end ? new Date(title.end).getTime() : undefined,
				})
			);
			return true;
		}
		return false;
	};
}

class KitsuExport extends APIExportableModule {
	inList: { [key: string]: number } = {};

	// Fetch all Kitsu titles to check if they already are in user list
	preMain = async (titles: Title[]): Promise<boolean> => {
		let notification = this.notification('info loading', [
			DOM.text('Checking current status of each titles'),
			DOM.space(),
			this.stopButton,
		]);
		let max = Math.ceil(titles.length / 500);
		for (let current = 1; current <= max; current++) {
			const ids = titles.slice((current - 1) * 500, current * 500).map((title) => title.services.ku as number);
			const response = await Runtime.request<JSONResponse>({
				url: `${KitsuService.APIUrl}
					?filter[user_id]=${Options.tokens.kitsuUser}
					&filter[mangaId]=${ids.join(',')}
					&fields[libraryEntries]=id,manga
					&include=manga
					&fields[manga]=id
					&page[limit]=500
					&page[offset]=${(current - 1) * 500}`,
				isJson: true,
				headers: KitsuService.LoggedHeaders(),
			});
			if (response.status >= 400) {
				this.stopButton.remove();
				notification.classList.remove('loading');
				this.notification('danger', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			const body = response.body as KitsuResponse;
			for (const title of body.data) {
				this.inList[title.relationships.manga.data.id] = +title.id;
			}
		}
		this.stopButton.remove();
		notification.classList.remove('loading');
		return true; // TODO: Also just *Import* at the same time to just have the latest values ?
	};

	createTitle = (title: Title): Partial<EntryAttributes> => {
		let values: Partial<EntryAttributes> = {
			status: this.manager.service.fromStatus(title.status),
			progress: title.progress.chapter,
			volumesOwned: title.progress.volume || 0,
			startedAt: null,
			finishedAt: null,
		};
		if (title.score !== undefined && title.score > 0) values.ratingTwenty = title.score; // TODO: convert ratingTwenty
		if (title.start !== undefined) {
			values.startedAt = new Date(title.start).toISOString();
		}
		if (title.end !== undefined) {
			values.finishedAt = new Date(title.end).toISOString();
		}
		return values;
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		if (this.manager.service.fromStatus(title.status) !== KitsuStatus.NONE) {
			const libraryEntryId = this.inList[title.services.ku as number];
			const method = libraryEntryId !== undefined ? 'PATCH' : 'POST';
			const url = `${KitsuService.APIUrl}${libraryEntryId !== undefined ? `/${libraryEntryId}` : ''}`;
			const response = await Runtime.request<JSONResponse>({
				url: url,
				method: method,
				headers: KitsuService.LoggedHeaders(),
				body: JSON.stringify({
					data: {
						attributes: this.createTitle(title),
					},
					relationships: {
						manga: {
							data: {
								type: 'manga',
								id: title.services.ku,
							},
						},
						user: {
							data: {
								type: 'users',
								id: Options.tokens.kitsuUser,
							},
						},
					},
					type: 'library-entries',
				}),
			});
			return response.ok;
		}
		return false;
	};
}

export class Kitsu extends ManageableService {
	service: KitsuService = new KitsuService();
	activeModule: ActivableModule = new KitsuActive(this);
	importModule: APIImportableModule<KitsuTitle> = new KitsuImport(this);
	exportModule: ExportableModule = new KitsuExport(this);
}

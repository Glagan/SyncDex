import { Options } from '../../src/Options';
import { Status, LoginStatus } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { Mochi } from '../../src/Mochi';
import { TitleCollection, Title } from '../../src/Title';
import { ManageableService, ActivableModule, ExportableModule, APIImportableModule, LoginMethod } from './Service';
import { Kitsu as KitsuService } from '../../src/Service/Kitsu';

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

class KitsuImport extends APIImportableModule<KitsuTitle> {
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

	handlePage = async (): Promise<KitsuTitle[] | false> => {
		const response = await Runtime.request<JSONResponse>({
			url: `https://kitsu.io/api/edge/library-entries?
					filter[user_id]=${Options.tokens.kitsuUser}&
					filter[kind]=manga&
					fields[libraryEntries]=status,progress,volumesOwned,manga&
					include=manga&
					fields[manga]=id&
					page[limit]=500&
					page[offset]=${(this.state.current - 1) * 500}`,
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
		let titles: KitsuTitle[] = [];
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
				})
			);
			return true;
		}
		return false;
	};
}

class KitsuExport extends ExportableModule {
	export = async (): Promise<void> => {
		// 1: Load all titles with Kitsu ID
		// 2: Export all titles one by one to the API endpoint
	};
}

export class Kitsu extends ManageableService {
	service: KitsuService = new KitsuService();
	activeModule: ActivableModule = new KitsuActive(this);
	importModule: APIImportableModule<KitsuTitle> = new KitsuImport(this);
	exportModule: ExportableModule = new KitsuExport(this);
}

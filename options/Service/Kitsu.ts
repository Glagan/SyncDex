import { Options } from '../../src/Options';
import { Runtime, JSONResponse, RequestStatus } from '../../src/Runtime';
import { Title } from '../../src/Title';
import { Service, ActivableModule, APIImportableModule, LoginMethod, APIExportableModule } from './Service';
import { KitsuStatus, KitsuTitle, KitsuManga, KitsuResponse, KitsuHeaders, KitsuAPI } from '../../src/Service/Kitsu';
import { DOM } from '../../src/DOM';
import { ServiceKey, ServiceName } from '../../src/core';

class KitsuActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.FORM;

	loggedIn = async (): Promise<RequestStatus> => {
		if (Options.tokens.kitsuUser === undefined || !Options.tokens.kitsuToken) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
			},
		});
		if (response.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return RequestStatus.BAD_REQUEST;
		}
		return RequestStatus.SUCCESS;
	};

	getUserId = async (): Promise<RequestStatus> => {
		if (Options.tokens.kitsuToken === undefined) return RequestStatus.MISSING_TOKEN;
		let data = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			method: 'GET',
			headers: KitsuHeaders(),
		});
		if (data.ok) {
			Options.tokens.kitsuUser = data.body.data[0].id;
			return RequestStatus.SUCCESS;
		} else if (data.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		}
		return RequestStatus.BAD_REQUEST;
	};

	login = async (username: string, password: string): Promise<RequestStatus> => {
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
			if (userIdResp !== RequestStatus.SUCCESS) return userIdResp;
			return RequestStatus.SUCCESS;
		} else if (data.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		}
		return RequestStatus.BAD_REQUEST;
	};

	logout = async (): Promise<void> => {
		delete Options.tokens.kitsuToken;
		delete Options.tokens.kitsuUser;
		return await Options.save();
	};
}

class KitsuImport extends APIImportableModule<KitsuTitle> {
	findManga = (included: KitsuManga[], id: string): KitsuManga => {
		for (const manga of included) {
			if (manga.id == id) return manga;
		}
		return included[0]; // never
	};

	handlePage = async (): Promise<KitsuTitle[] | false> => {
		const response = await Runtime.request<JSONResponse>({
			url: `${KitsuAPI}?
					filter[user_id]=${Options.tokens.kitsuUser}&
					filter[kind]=manga&
					fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,startedAt,finishedAt,manga&
					include=manga&
					fields[manga]=canonicalTitle&
					page[limit]=500&
					page[offset]=${(this.state.current - 1) * 500}`,
			isJson: true,
			headers: KitsuHeaders(),
		});
		if (response.status >= 400) {
			this.notification('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
			return false;
		}
		if (response.body.errors !== undefined) {
			this.notification(
				'warning',
				'The Request failed, check if you are logged in and your token is valid or retry later.'
			);
			return false;
		}
		let titles: KitsuTitle[] = [];
		const body = response.body as KitsuResponse;
		// Each row has a data-id field
		for (const title of body.data) {
			if (!title.relationships.manga.data) continue;
			const manga = this.findManga(body.included, title.relationships.manga.data.id);
			titles.push(
				new KitsuTitle(parseInt(title.relationships.manga.data.id), {
					id: parseInt(title.relationships.manga.data.id),
					progress: {
						chapter: title.attributes.progress,
						volume: title.attributes.volumesOwned,
					},
					status: title.attributes.status,
					score: title.attributes.ratingTwenty !== null ? title.attributes.ratingTwenty : 0,
					start: title.attributes.startedAt ? new Date(title.attributes.startedAt) : undefined,
					end: title.attributes.finishedAt ? new Date(title.attributes.finishedAt) : undefined,
					name: manga.attributes.canonicalTitle,
				})
			);
		}
		// We get 500 entries per page
		this.state.max = Math.ceil(body.meta.count / 500);
		return titles;
	};
}

class KitsuExport extends APIExportableModule {
	onlineList: { [key: string]: number | undefined } = {};

	// Fetch all Kitsu titles to check if they already are in user list
	preMain = async (titles: Title[]): Promise<boolean> => {
		let notification = this.notification('default', [
			DOM.text('Checking current status of each titles'),
			DOM.space(),
			this.stopButton,
		]);
		let max = Math.ceil(titles.length / 500);
		for (let current = 1; current <= max; current++) {
			const ids = titles.slice((current - 1) * 500, current * 500).map((title) => title.services.ku as number);
			const response = await Runtime.request<JSONResponse>({
				url: `${KitsuAPI}
					?filter[user_id]=${Options.tokens.kitsuUser}
					&filter[mangaId]=${ids.join(',')}
					&fields[libraryEntries]=id,manga
					&include=manga
					&fields[manga]=id
					&page[limit]=500`,
				isJson: true,
				headers: KitsuHeaders(),
			});
			if (response.status >= 400) {
				this.stopButton.remove();
				notification.classList.remove('loading');
				this.notification('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			const body = response.body as KitsuResponse;
			for (const title of body.data) {
				if (title.relationships.manga.data) {
					this.onlineList[title.relationships.manga.data.id] = +title.id;
				}
			}
		}
		this.stopButton.remove();
		notification.classList.remove('loading');
		return true; // TODO: Also just *Import* at the same time to just have the latest values ?
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = KitsuTitle.fromTitle(title);
		if (exportTitle && exportTitle.status !== KitsuStatus.NONE) {
			const libraryEntryId = this.onlineList[exportTitle.id];
			if (libraryEntryId) {
				exportTitle.libraryEntryId = libraryEntryId;
			}
			const responseStatus = await exportTitle.persist();
			return responseStatus == RequestStatus.SUCCESS;
		}
		return false;
	};
}

export class Kitsu extends Service {
	key: ServiceKey = ServiceKey.Kitsu;
	name: ServiceName = ServiceName.Kitsu;

	activeModule: KitsuActive = new KitsuActive(this);
	importModule: KitsuImport = new KitsuImport(this);
	exportModule: KitsuExport = new KitsuExport(this);
}

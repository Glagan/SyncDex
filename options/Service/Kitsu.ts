import { Options } from '../../src/Options';
import { Runtime } from '../../src/Runtime';
import { ServiceKeyType, ActivableName, ActivableKey, Title } from '../../src/Title';
import { Service, ActivableModule, LoginMethod, ActivableService, LoginModule } from './Service';
import { KitsuTitle, KitsuManga, KitsuResponse, KitsuHeaders, KitsuAPI } from '../../src/Service/Kitsu';
import { DOM } from '../../src/DOM';
import { Modal } from '../Modal';
import { APIImportableModule } from './Import';
import { APIExportableModule } from './Export';

interface KitsuUserResponse {
	data: {
		id: string;
		type: 'users';
		links: {};
		attributes: {};
		relationships: {};
	}[];
	meta: {};
	links: {};
}

class KitsuLogin extends LoginModule {
	loggedIn = async (): Promise<RequestStatus> => {
		if (Options.tokens.kitsuUser === undefined || !Options.tokens.kitsuToken) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest<KitsuUserResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
			},
		});
		return Runtime.responseStatus(response);
	};

	getUserId = async (): Promise<RequestStatus> => {
		if (Options.tokens.kitsuToken === undefined) return RequestStatus.MISSING_TOKEN;
		let response = await Runtime.jsonRequest<KitsuUserResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			method: 'GET',
			headers: KitsuHeaders(),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		Options.tokens.kitsuUser = response.body.data[0].id;
		return RequestStatus.SUCCESS;
	};

	login = async (username: string, password: string): Promise<RequestStatus> => {
		let response = await Runtime.jsonRequest({
			url: 'https://kitsu.io/api/oauth/token',
			method: 'POST',
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(
				password
			)}`,
		});
		if (!response.ok) return Runtime.responseStatus(response);
		Options.tokens.kitsuToken = response.body.access_token;
		const userIdResp = await this.getUserId();
		await Options.save();
		if (userIdResp !== RequestStatus.SUCCESS) return userIdResp;
		return RequestStatus.SUCCESS;
	};

	logout = async (): Promise<void> => {
		delete Options.tokens.kitsuToken;
		delete Options.tokens.kitsuUser;
		return await Options.save();
	};
}

class KitsuActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.FORM;

	preModalForm = (modal: Modal): void => {
		modal.body.appendChild(
			DOM.create('div', {
				class: 'message',
				childs: [
					DOM.create('div', { class: 'icon' }),
					DOM.create('div', {
						class: 'content',
						childs: [
							DOM.text('No Account ? '),
							DOM.create('a', {
								textContent: 'Register',
								href: 'https://kitsu.io/',
								target: '_blank',
								childs: [DOM.space(), DOM.icon('external-link-alt')],
							}),
						],
					}),
				],
			})
		);
	};
}

class KitsuImport extends APIImportableModule {
	findManga = (included: KitsuManga[], id: string): KitsuManga => {
		for (const manga of included) {
			if (manga.id == id) return manga;
		}
		return included[0]; // never
	};

	handlePage = async (): Promise<KitsuTitle[] | false> => {
		const response = await Runtime.jsonRequest<KitsuResponse>({
			url: `${KitsuAPI}?
					filter[user_id]=${Options.tokens.kitsuUser}&
					filter[kind]=manga&
					fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,startedAt,finishedAt,manga&
					include=manga&
					fields[manga]=canonicalTitle&
					page[limit]=500&
					page[offset]=${(this.state.current - 1) * 500}`,
			headers: KitsuHeaders(),
		});
		if (!response.ok) {
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
		const body = response.body;
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
					status: KitsuTitle.toStatus(title.attributes.status),
					score: title.attributes.ratingTwenty !== null ? title.attributes.ratingTwenty * 5 : 0,
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
		let notification = this.notification('loading', 'Checking current status of each titles...');
		let max = Math.ceil(titles.length / 500);
		for (let current = 1; current <= max; current++) {
			const ids = titles.slice((current - 1) * 500, current * 500).map((title) => title.services.ku as number);
			const response = await Runtime.jsonRequest<KitsuResponse>({
				url: `${KitsuAPI}
					?filter[user_id]=${Options.tokens.kitsuUser}
					&filter[mangaId]=${ids.join(',')}
					&fields[libraryEntries]=id,manga
					&include=manga
					&fields[manga]=id
					&page[limit]=500`,
				headers: KitsuHeaders(),
			});
			if (!response.ok) {
				notification.classList.remove('loading');
				this.notification('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			const body = response.body;
			for (const title of body.data) {
				if (title.relationships.manga.data) {
					this.onlineList[title.relationships.manga.data.id] = +title.id;
				}
			}
		}
		notification.classList.remove('loading');
		return true;
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = KitsuTitle.fromLocalTitle(title) as KitsuTitle | undefined;
		if (exportTitle && exportTitle.status !== Status.NONE) {
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

export class Kitsu extends Service implements ActivableService {
	static readonly serviceName: ActivableName = ActivableName.Kitsu;
	static readonly key: ActivableKey = ActivableKey.Kitsu;

	static link(id: ServiceKeyType): string {
		if (typeof id !== 'number') return '#';
		return KitsuTitle.link(id);
	}

	loginModule: KitsuLogin = new KitsuLogin();
	activeModule: KitsuActive = new KitsuActive(this);
	importModule: KitsuImport = new KitsuImport(this);
	exportModule: KitsuExport = new KitsuExport(this);
}

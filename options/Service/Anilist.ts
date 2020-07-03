import { DOM, AppendableElement } from '../../src/DOM';
import { Options } from '../../src/Options';
import { Runtime, RequestStatus } from '../../src/Runtime';
import { Title, ServiceKey, ServiceName } from '../../src/Title';
import { Service, ActivableModule, APIImportableModule, ImportStep, APIExportableModule, LoginMethod } from './Service';
import { AnilistStatus, AnilistTitle, AnilistDate, AnilistAPI, AnilistHeaders } from '../../src/Service/Anilist';

interface AnilistViewerResponse {
	data: {
		Viewer: {
			name: string;
		};
	};
}

interface AnilistListTitle {
	mediaId: number;
	status: AnilistStatus;
	progress: number;
	progressVolumes: number;
	startedAt: AnilistDate;
	completedAt: AnilistDate;
	score: number | null;
	media: {
		title: {
			userPreferred: string;
		};
	};
}

interface AnilistListResponse {
	data: {
		MediaListCollection: {
			lists: {
				name: string;
				entries: AnilistListTitle[];
			}[];
		};
	};
}

class AnilistActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';
	static LoginQuery: string = `query { Viewer { id } }`;
	form?: HTMLFormElement;
	login = undefined;

	loggedIn = async (): Promise<RequestStatus> => {
		if (!Options.tokens.anilistToken === undefined) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest({
			method: 'POST',
			url: AnilistAPI,
			headers: AnilistHeaders(),
			body: JSON.stringify({ query: AnilistActive.LoginQuery }),
		});
		return Runtime.responseStatus(response);
	};

	logout = async (): Promise<void> => {
		delete Options.tokens.anilistToken;
		return await Options.save();
	};
}

class AnilistImport extends APIImportableModule<AnilistTitle> {
	currentPage: number = 0;

	static viewerQuery = `
		query {
			Viewer {
				name
			}
		}`;

	static listQuery = `
		query ($userName: String) {
			MediaListCollection(userName: $userName, type: MANGA) {
				lists {
					entries {
						id
						mediaId
						status
						score(format: POINT_100)
						progress
						progressVolumes
						startedAt {
							year
							month
							day
						}
						completedAt {
							year
							month
							day
						}
						media {
							title {
								userPreferred
							}
						}
					}
				}
			}
		}`; // Require $userName

	getNextPage = (): boolean => {
		return this.currentPage++ == 0;
	};

	getProgress = (step: ImportStep, total?: number): string => {
		if (step == ImportStep.FETCH_PAGES) {
			return `Importing Titles.`;
		}
		// ImportStep.CONVERT_TITLES
		this.currentTitle = Math.min(total as number, this.currentTitle + this.perConvert);
		return `Converting title ${this.currentTitle} out of ${total}.`;
	};

	handlePage = async (): Promise<AnilistTitle[] | false> => {
		// Find required username
		let response = await Runtime.jsonRequest({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistImport.viewerQuery,
			}),
		});
		if (!response.ok) {
			this.notification(
				'warning',
				`The request failed, maybe Anilist is having problems or your token expired, retry later.`
			);
			return false;
		}
		const username = (response.body as AnilistViewerResponse).data.Viewer.name;
		// Get list of *all* titles
		response = await Runtime.jsonRequest<AnilistListResponse>({
			url: AnilistAPI,
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: AnilistImport.listQuery,
				variables: {
					userName: username,
				},
			}),
		});
		if (response.code >= 500) {
			this.notification('warning', 'The request failed, maybe Anilist is having problems, retry later.');
			return false;
		} else if (response.code >= 400) {
			this.notification('warning', 'Bad Request, check if your token is valid.');
			return false;
		}
		// Transform to array
		let titles: AnilistTitle[] = [];
		const body = response.body;
		for (const list of body.data.MediaListCollection.lists) {
			for (const entry of list.entries) {
				titles.push(
					new AnilistTitle(entry.mediaId, {
						id: entry.mediaId,
						progress: {
							chapter: entry.progress,
							volume: entry.progressVolumes,
						},
						status: entry.status,
						start: AnilistTitle.dateFromAnilist(entry.startedAt),
						end: AnilistTitle.dateFromAnilist(entry.completedAt),
						score: entry.score ? entry.score : 0,
					})
				);
			}
		}
		return titles;
	};
}

class AnilistExport extends APIExportableModule {
	exportTitle = async (title: Title): Promise<boolean> => {
		const exportTitle = AnilistTitle.fromTitle(title);
		if (exportTitle && exportTitle.status !== AnilistStatus.NONE) {
			const responseStatus = await exportTitle.persist();
			return responseStatus == RequestStatus.SUCCESS;
		}
		return false;
	};
}

export class Anilist extends Service {
	readonly key: ServiceKey = ServiceKey.Anilist;
	readonly name: ServiceName = ServiceName.Anilist;

	createTitle = (): AppendableElement => {
		return DOM.create('span', {
			class: 'ani',
			textContent: 'Ani',
			childs: [
				DOM.create('span', {
					class: 'list',
					textContent: 'List',
				}),
			],
		});
	};

	activeModule: AnilistActive = new AnilistActive(this);
	importModule: AnilistImport = new AnilistImport(this);
	exportModule: AnilistExport = new AnilistExport(this);
}

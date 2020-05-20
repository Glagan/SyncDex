import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { ServiceName, Status, LoginStatus, LoginMethod, ServiceKey } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Service, ActivableModule, ExportableModule, APIImportableModule, ImportStep } from './Service';

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

interface AnilistTitle {
	mediaId: number;
	status: AnilistStatus;
	progress: number;
	progressVolumes: number;
}

interface AnilistList {
	name: string;
	entries: AnilistTitle[];
}

interface AnilistResponse {
	data: {
		MediaListCollection: {
			lists: AnilistList[];
		};
	};
}

class AnilistActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';
	form?: HTMLFormElement;
	login = undefined;

	isLoggedIn = async (): Promise<LoginStatus> => {
		if (!Options.tokens.anilistToken === undefined) return LoginStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			method: 'POST',
			url: 'https://graphql.anilist.co',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.anilistToken}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({ query: `query { Viewer { id } }` }),
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
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

	getNextPage = (): boolean => {
		return this.currentPage++ == 0;
	};

	getProgress = (step: ImportStep, total?: number): string => {
		if (step == ImportStep.FETCH_PAGES) {
			return `Importing Titles.`;
		}
		// ImportStep.CONVERT_TITLES
		return `Converting title ${++this.currentTitle} out of ${total}.`;
	};

	handlePage = async (): Promise<AnilistTitle[] | false> => {
		// Find required username
		let response = await Runtime.request<JSONResponse>({
			url: 'https://graphql.anilist.co/',
			method: 'POST',
			isJson: true,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				Authorization: `Bearer ${Options.tokens.anilistToken}`,
			},
			body: JSON.stringify({
				query: AnilistImport.viewerQuery,
			}),
		});
		if (response.status >= 400) {
			this.notification(
				'danger',
				`The request failed, maybe Anilist is having problems or your token expired, retry later.`
			);
			return false;
		}
		const username = (response.body as ViewerResponse).data.Viewer.name;
		// Get list of *all* titles
		response = await Runtime.request<JSONResponse>({
			url: 'https://graphql.anilist.co/',
			method: 'POST',
			isJson: true,
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
		if (response.status >= 500) {
			this.notification('danger', 'The request failed, maybe Anilist is having problems, retry later.');
			return false;
		} else if (response.status >= 400) {
			this.notification('danger', 'Bad Request, check if your token is valid.');
			return false;
		}
		// Transform to array
		let titles: AnilistTitle[] = [];
		const body = response.body as AnilistResponse;
		for (const list of body.data.MediaListCollection.lists) {
			for (const entry of list.entries) {
				titles.push({
					mediaId: entry.mediaId,
					progress: entry.progress,
					progressVolumes: entry.progressVolumes,
					status: entry.status,
				});
			}
		}
		return titles;
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

	convertTitle = async (titles: TitleCollection, title: AnilistTitle): Promise<boolean> => {
		const connections = await Mochi.find(title.mediaId, 'Anilist');
		if (connections !== undefined && connections['MangaDex'] !== undefined) {
			titles.add(
				new Title(connections['MangaDex'] as number, {
					services: { al: title.mediaId },
					progress: {
						chapter: title.progress,
						volume: title.progressVolumes,
					},
					status: this.toStatus(title.status),
					chapters: [],
				})
			);
			return true;
		}
		return false;
	};
}

class AnilistExport extends ExportableModule {
	export = async (): Promise<void> => {
		// 1: Load all titles with Anilist ID
		// 2: Update entries one by one
	};
}

export class Anilist extends Service {
	name: ServiceName = ServiceName.Anilist;
	key: ServiceKey = ServiceKey.Anilist;

	activeModule: ActivableModule = new AnilistActive(this);
	importModule: APIImportableModule<AnilistTitle> = new AnilistImport(this);
	exportModule: ExportableModule = new AnilistExport(this);

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
}

import { DOM } from '../../src/DOM';
import { Options } from '../../src/Options';
import { Status, LoginStatus } from '../../src/Service/Service';
import { Runtime, JSONResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import {
	ManageableService,
	ActivableModule,
	APIImportableModule,
	ImportStep,
	APIExportableModule,
	LoginMethod,
} from './Service';
import { Anilist as AnilistService } from '../../src/Service/Anilist';

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

interface AnilistDate {
	day: number | null;
	month: number | null;
	year: number | null;
}

interface AnilistTitle {
	mediaId: number;
	status: AnilistStatus;
	progress: number;
	progressVolumes: number;
	startedAt: AnilistDate;
	completedAt: AnilistDate;
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
			url: AnilistService.APIUrl,
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
			url: AnilistService.APIUrl,
			method: 'POST',
			isJson: true,
			headers: AnilistService.LoggedHeaders(),
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
			url: AnilistService.APIUrl,
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
					startedAt: entry.startedAt,
					completedAt: entry.completedAt,
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

	dateToNumber = (date: AnilistDate): number | undefined => {
		if (date.day !== null && date.month !== null && date.year !== null) {
			return new Date(date.year, date.month, date.day).getTime();
		}
		return undefined;
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
					start: this.dateToNumber(title.startedAt),
					end: this.dateToNumber(title.completedAt),
				})
			);
			return true;
		}
		return false;
	};
}

class AnilistExport extends APIExportableModule {
	// Fields can have missing values and will be ignored
	static singleUpdateQuery = `
		mutation ($mediaId: Int, $status: MediaListStatus, $score: Float, $progress: Int, $progressVolumes: Int, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {
			SaveMediaListEntry (mediaId: $mediaId, status: $status, score: $score, progress: $progress, progressVolumes: $progressVolumes, startedAt: $startedAt, completedAt: $completedAt) {
				mediaId
				status
				score
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
			}
		}`;

	fromStatus = (status: Status): string => {
		switch (status) {
			case Status.READING:
				return 'CURRENT';
			case Status.COMPLETED:
				return 'COMPLETED';
			case Status.PLAN_TO_READ:
				return 'PLANNING';
			case Status.DROPPED:
				return 'DROPPED';
			case Status.PAUSED:
				return 'PAUSED';
			case Status.REREADING:
				return 'REPEATING';
		}
		return 'INVALID';
	};

	selectTitles = async (): Promise<Title[]> => {
		return (await TitleCollection.get()).collection.filter((title) => {
			return title.services.al !== undefined && title.services.al > 0 && title.status !== Status.NONE;
		});
	};

	createTitle = (title: Title): Partial<AnilistTitle & { score: number | null }> => {
		let values: Partial<AnilistTitle & { score: number | null }> = {
			mediaId: title.services.al as number,
			status: this.fromStatus(title.status) as AnilistStatus,
			progress: title.progress.chapter,
			progressVolumes: title.progress.volume || 0,
		};
		if (title.score !== undefined && title.score > 0) values.score = title.score;
		if (title.start !== undefined) {
			const date = new Date(title.start);
			values.startedAt = { day: date.getDate(), month: date.getMonth() + 1, year: date.getUTCFullYear() };
		}
		if (title.end !== undefined) {
			const date = new Date(title.end);
			values.completedAt = { day: date.getDate(), month: date.getMonth() + 1, year: date.getUTCFullYear() };
		}
		return values;
	};

	exportTitle = async (title: Title): Promise<boolean> => {
		if (this.fromStatus(title.status) !== 'INVALID') {
			const response = await Runtime.request<JSONResponse>({
				url: AnilistService.APIUrl,
				method: 'POST',
				headers: AnilistService.LoggedHeaders(),
				body: JSON.stringify({
					query: AnilistExport.singleUpdateQuery,
					variables: this.createTitle(title),
				}),
			});
			return response.status >= 200 && response.status < 400;
		}
		return false;
	};
}

export class Anilist extends ManageableService {
	service: AnilistService = new AnilistService();
	activeModule: ActivableModule = new AnilistActive(this);
	importModule: APIImportableModule<AnilistTitle> = new AnilistImport(this);
	exportModule: APIExportableModule = new AnilistExport(this);

	createTitle = (): HTMLElement => {
		return DOM.create('span', {
			class: this.service.name.toLowerCase(),
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

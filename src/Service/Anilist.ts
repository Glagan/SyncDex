import { Runtime } from '../Core/Runtime';
import { ExternalTitle, ExternalTitles, FoundTitle } from '../Core/Title';
import { Options } from '../Core/Options';
import { ActivableKey, ActivableName, Service, Services } from '../Core/Service';
import { ImportModule, ModuleOptions } from '../Core/Module';
import { ModuleInterface } from '../Core/ModuleInterface';
import { AppendableElement, DOM } from '../Core/DOM';
import { LoginMethod } from '../Core/Service';

export const enum AnilistStatus {
	NONE = 'NONE',
	READING = 'CURRENT',
	COMPLETED = 'COMPLETED',
	PAUSED = 'PAUSED',
	DROPPED = 'DROPPED',
	PLAN_TO_READ = 'PLANNING',
	REREADING = 'REPEATING',
}

export interface AnilistDate {
	day: number | null;
	month: number | null;
	year: number | null;
}

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
		chapters: number | null;
		volumes: number | null;
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

export interface SaveMediaListEntry {
	id: number;
	mediaId: number;
	status: AnilistStatus;
	score?: number;
	progress?: number;
	progressVolumes?: number;
	startedAt?: AnilistDate;
	completedAt?: AnilistDate;
}

export interface AnilistMedia {
	title: {
		userPreferred: string;
	};
	chapters: number | null;
	volumes: number | null;
	mediaListEntry: {
		id: number;
		status: AnilistStatus;
		score: number | null;
		progress: number;
		progressVolumes: number;
		startedAt: AnilistDate;
		completedAt: AnilistDate;
	} | null;
}

export interface AnilistGetResponse {
	data: {
		Media: AnilistMedia;
	};
}

interface AnilistPersistResponse {
	data: {
		SaveMediaListEntry: SaveMediaListEntry;
	};
}

export interface AnilistHeaders {
	Authorization: string;
	'Content-Type': string;
	Accept: string;
	[key: string]: string;
}

export const AnilistAPI = 'https://graphql.anilist.co';
export const AnilistHeaders = (): AnilistHeaders => {
	return {
		Authorization: `Bearer ${Options.tokens.anilistToken}`,
		'Content-Type': 'application/json',
		Accept: 'application/json',
	};
};

export class AnilistImport extends ImportModule {
	static viewerQuery = `
		query {
			Viewer {
				name
			}
		}`.replace(/\n\t+/g, ' ');

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
							chapters
							volumes
						}
					}
				}
			}
		}`.replace(/\n\t+/g, ' '); // Require $userName
	username: string = '';

	constructor(moduleInterface?: ModuleInterface) {
		super(Anilist, moduleInterface);
	}

	preExecute = async (): Promise<boolean> => {
		// Find required username
		const viewerResponse = await Runtime.jsonRequest({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistImport.viewerQuery,
			}),
		});
		if (!viewerResponse.ok) {
			this.interface?.message(
				'warning',
				`The request failed, maybe Anilist is having problems or your token expired, retry later.`
			);
			return false;
		}
		this.username = (viewerResponse.body as AnilistViewerResponse).data.Viewer.name;
		return true;
	};

	execute = async (options: ModuleOptions): Promise<boolean | FoundTitle[]> => {
		// Get list of *all* titles
		const response = await Runtime.jsonRequest<AnilistListResponse>({
			url: AnilistAPI,
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: AnilistImport.listQuery,
				variables: {
					userName: this.username,
				},
			}),
		});
		if (response.code >= 500) {
			this.interface?.message('warning', 'The request failed, maybe Anilist is having problems, retry later.');
			return false;
		} else if (response.code >= 400) {
			this.interface?.message('warning', 'Bad Request, check if your token is valid.');
			return false;
		}

		// Transform to array
		const medias: FoundTitle[] = [];
		const body = response.body;
		for (const list of body.data.MediaListCollection.lists) {
			for (const entry of list.entries) {
				medias.push({
					progress: {
						chapter: entry.progress,
						volume: entry.progressVolumes,
					},
					max: {
						chapter: entry.media.chapters ?? undefined,
						volume: entry.media.volumes ?? undefined,
					},
					name: entry.media.title.userPreferred,
					status: AnilistTitle.toStatus(entry.status),
					start: AnilistTitle.dateFromAnilist(entry.startedAt),
					end: AnilistTitle.dateFromAnilist(entry.completedAt),
					score: entry.score ? entry.score : 0,
					mochi: entry.mediaId,
				});
			}
		}
		return medias;
	};
}

export class Anilist extends Service {
	static readonly serviceName: ActivableName = ActivableName.Anilist;
	static readonly serviceKey: ActivableKey = ActivableKey.Anilist;

	static loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	static loginUrl: string = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';

	static async loggedIn(): Promise<RequestStatus> {
		if (Options.tokens.anilistToken === undefined) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest({
			method: 'POST',
			url: AnilistAPI,
			headers: AnilistHeaders(),
			body: JSON.stringify({ query: `query { Viewer { id } }` }),
		});
		return Runtime.responseStatus(response);
	}

	static async logout(): Promise<void> {
		delete Options.tokens.anilistToken;
	}

	static importModule = (moduleInterface?: ModuleInterface) => new AnilistImport(moduleInterface);

	static link(key: MediaKey) {
		return `https://anilist.co/manga/${key.id}`;
	}

	static createTitle(): AppendableElement {
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
	}
}

Services[ActivableKey.Anilist] = Anilist;

export class AnilistTitle extends ExternalTitle {
	static service = Anilist;

	mediaEntryId: number = 0;

	static readonly getQuery = `
		query ($mediaId: Int) {
			Media(id: $mediaId) {
				title {
					userPreferred
				}
				chapters
				volumes
				mediaListEntry {
					id
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
				}
			}
		}`.replace(/\n\t+/g, ' ');

	static readonly persistQuery = `
		mutation ($mediaId: Int, $status: MediaListStatus, $score: Float, $progress: Int, $progressVolumes: Int, $startedAt: FuzzyDateInput, $completedAt: FuzzyDateInput) {
			SaveMediaListEntry (mediaId: $mediaId, status: $status, score: $score, progress: $progress, progressVolumes: $progressVolumes, startedAt: $startedAt, completedAt: $completedAt) {
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
			}
		}`.replace(/\n\t+/g, ' ');

	static readonly deleteQuery = `
		mutation ($id: Int) {
			DeleteMediaListEntry (id: $id) {
				deleted
			}
		}`.replace(/\n\t+/g, ' ');

	static dateFromAnilist = (date: AnilistDate): Date | undefined => {
		if (date.day !== null && date.month !== null && date.year !== null) {
			return new Date(date.year, date.month - 1, date.day);
		}
		return undefined;
	};

	static get = async (key: MediaKey): Promise<AnilistTitle | RequestStatus> => {
		const id = key.id!;
		if (!Options.tokens.anilistToken) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest<AnilistGetResponse>({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistTitle.getQuery,
				variables: {
					mediaId: id,
				},
			}),
		});
		if (!response.ok) return Runtime.responseStatus<JSONResponse>(response);
		// Convert Response to AnilistTitle
		const body = response.body;
		const mediaEntry = body.data.Media.mediaListEntry;
		const values: Partial<AnilistTitle> = {
			key: key,
			name: body.data.Media.title.userPreferred,
			loggedIn: true,
			max: { chapter: body.data.Media.chapters ?? undefined, volume: body.data.Media.volumes ?? undefined },
		};
		if (mediaEntry) {
			values.mediaEntryId = mediaEntry.id;
			values.inList = true;
			values.progress = { chapter: mediaEntry.progress };
			if (mediaEntry.progressVolumes > 0) values.progress.volume = mediaEntry.progressVolumes;
			values.status = AnilistTitle.toStatus(mediaEntry.status);
			values.score = mediaEntry.score ? mediaEntry.score : 0;
			values.start = AnilistTitle.dateFromAnilist(mediaEntry.startedAt);
			values.end = AnilistTitle.dateFromAnilist(mediaEntry.completedAt);
		} else values.inList = false;
		return new AnilistTitle(values);
	};

	static dateToAnilist = (date?: Date): AnilistDate | undefined => {
		if (date !== undefined) {
			return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
		}
		return undefined;
	};

	persist = async (): Promise<RequestStatus> => {
		if (!Options.tokens.anilistToken) return RequestStatus.MISSING_TOKEN;
		if (this.status === Status.NONE) return RequestStatus.FAIL;
		const response = await Runtime.jsonRequest<AnilistPersistResponse>({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistTitle.persistQuery,
				variables: <SaveMediaListEntry>{
					mediaId: this.key.id,
					status: AnilistTitle.fromStatus(this.status),
					score: this.score !== undefined && this.score > 0 ? this.score : undefined,
					progress: Math.floor(this.progress.chapter),
					progressVolumes: this.progress.volume,
					startedAt: AnilistTitle.dateToAnilist(this.start),
					completedAt: AnilistTitle.dateToAnilist(this.end),
				},
			}),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.mediaEntryId = response.body.data.SaveMediaListEntry.id;
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		if (!Options.tokens.anilistToken) return RequestStatus.MISSING_TOKEN;
		if (this.mediaEntryId <= 0) return RequestStatus.BAD_REQUEST;
		const response = await Runtime.jsonRequest({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistTitle.deleteQuery,
				variables: {
					id: this.mediaEntryId,
				},
			}),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.mediaEntryId = 0;
		this.inList = false;
		return RequestStatus.DELETED;
	};

	static toStatus = (status: AnilistStatus): Status => {
		switch (status) {
			case AnilistStatus.READING:
				return Status.READING;
			case AnilistStatus.COMPLETED:
				return Status.COMPLETED;
			case AnilistStatus.PAUSED:
				return Status.PAUSED;
			case AnilistStatus.DROPPED:
				return Status.DROPPED;
			case AnilistStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
			case AnilistStatus.REREADING:
				return Status.REREADING;
		}
		return Status.NONE;
	};

	static fromStatus = (status: Status): AnilistStatus => {
		switch (status) {
			case Status.READING:
				return AnilistStatus.READING;
			case Status.COMPLETED:
				return AnilistStatus.COMPLETED;
			case Status.PAUSED:
				return AnilistStatus.PAUSED;
			case Status.DROPPED:
				return AnilistStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return AnilistStatus.PLAN_TO_READ;
			case Status.REREADING:
				return AnilistStatus.REREADING;
		}
		return AnilistStatus.NONE;
	};

	static idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?anilist\.co\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return { id: parseInt(regexp[1]) };
		return { id: 0 };
	};

	static idFromString = (str: string): MediaKey => {
		return { id: parseInt(str) };
	};

	get mochi(): number {
		return this.key.id!;
	}
}

ExternalTitles[ActivableKey.Anilist] = AnilistTitle;

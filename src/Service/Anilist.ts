import { Runtime, RequestStatus } from '../Runtime';
import { Title, ServiceKeyType, ActivableName, ActivableKey, ExternalTitle, LocalTitle } from '../Title';
import { Options } from '../Options';

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

/**
 * An Anilist MediaEntry.
 * Score are automatically converted in a 0-100 range.
 */
export class AnilistTitle extends ExternalTitle {
	static readonly serviceName: ActivableName = ActivableName.Anilist;
	static readonly serviceKey: ActivableKey = ActivableKey.Anilist;

	static link(id: ServiceKeyType): string {
		return `https://anilist.co/manga/${id}`;
	}

	id: number;
	mediaEntryId: number;

	static readonly getQuery = `
		query ($mediaId: Int) {
			Media(id: $mediaId) {
				title {
					userPreferred
				}
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
		}`;
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
		}`;
	static readonly deleteQuery = `
		mutation ($id: Int) {
			DeleteMediaListEntry (id: $id) {
				deleted
			}
		}`;

	constructor(id: ServiceKeyType, title?: Partial<AnilistTitle>) {
		super(title);
		if (typeof id !== 'number') throw 'Anilist ID can only be a number';
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : Status.NONE;
		this.mediaEntryId = title && title.mediaEntryId !== undefined ? title.mediaEntryId : 0;
	}

	static dateFromAnilist = (date: AnilistDate): Date | undefined => {
		if (date.day !== null && date.month !== null && date.year !== null) {
			return new Date(date.year, date.month, date.day);
		}
		return undefined;
	};

	static get = async (id: ServiceKeyType): Promise<Title | RequestStatus> => {
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
			name: body.data.Media.title.userPreferred,
			loggedIn: true,
		};
		if (mediaEntry) {
			values.mediaEntryId = mediaEntry.id;
			values.inList = true;
			values.progress = {
				chapter: mediaEntry.progress,
				volume: mediaEntry.progressVolumes,
			};
			values.status = AnilistTitle.toStatus(mediaEntry.status);
			values.score = mediaEntry.score ? mediaEntry.score : 0;
			values.start = AnilistTitle.dateFromAnilist(mediaEntry.startedAt);
			values.end = AnilistTitle.dateFromAnilist(mediaEntry.completedAt);
		} else values.inList = false;
		return new AnilistTitle(id as number, values);
	};

	static dateToAnilist = (date?: Date): AnilistDate | undefined => {
		if (date !== undefined) {
			return { day: date.getDate(), month: date.getMonth() + 1, year: date.getUTCFullYear() };
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
					mediaId: this.id,
					status: AnilistTitle.fromStatus(this.status),
					score: this.score !== undefined && this.score > 0 ? this.score : undefined,
					progress: this.progress.chapter,
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
		return RequestStatus.SUCCESS;
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

	static fromTitle = (title: LocalTitle): AnilistTitle | undefined => {
		if (!title.services.al) return undefined;
		return new AnilistTitle(title.services.al, {
			progress: title.progress,
			status: title.status,
			score: title.score ? title.score : undefined,
			start: title.start ? new Date(title.start) : undefined,
			end: title.end ? new Date(title.end) : undefined,
			name: title.name,
		});
	};

	static idFromLink = (href: string): number => {
		const regexp = /https:\/\/(?:www\.)?anilist\.co\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return parseInt(regexp[1]);
		return 0;
	};

	get mochi(): number {
		return this.id;
	}
}

import { Runtime, RequestStatus } from '../Runtime';
import { ServiceTitle, Title, ServiceKey, ServiceName } from '../Title';
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

export class AnilistTitle extends ServiceTitle<AnilistTitle> {
	readonly serviceKey: ServiceKey = ServiceKey.Anilist;
	readonly serviceName: ServiceName = ServiceName.Anilist;

	status: AnilistStatus = AnilistStatus.NONE;
	mediaEntryId: number = 0;

	static readonly getQuery = `
		query ($mediaId: Int) {
			Media(id: $mediaId) {
				title {
					userPreferred
				}
				mediaListEntry {
					id
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
			}
		}`;
	static readonly persistQuery = `
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
	static readonly deleteQuery = `
		mutation ($id: Int) {
			DeleteMediaListEntry (id: $id) {
				deleted
			}
		}`;

	static dateFromAnilist = (date: AnilistDate): Date | undefined => {
		if (date.day !== null && date.month !== null && date.year !== null) {
			return new Date(date.year, date.month, date.day);
		}
		return undefined;
	};

	static get = async <T extends ServiceTitle<T> = AnilistTitle>(
		id: number | string
	): Promise<AnilistTitle | RequestStatus> => {
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
		};
		if (mediaEntry) {
			values.mediaEntryId = mediaEntry.id;
			values.progress = {
				chapter: mediaEntry.progress,
				volume: mediaEntry.progressVolumes,
			};
			values.status = mediaEntry.status;
			values.score = mediaEntry.score ? mediaEntry.score : 0;
			values.start = AnilistTitle.dateFromAnilist(mediaEntry.startedAt);
			values.end = AnilistTitle.dateFromAnilist(mediaEntry.completedAt);
		}
		return new AnilistTitle(id, values);
	};

	static dateToAnilist = (date?: Date): AnilistDate | undefined => {
		if (date !== undefined) {
			return { day: date.getDate(), month: date.getMonth() + 1, year: date.getUTCFullYear() };
		}
		return undefined;
	};

	persist = async (): Promise<RequestStatus> => {
		if (this.status !== AnilistStatus.NONE) return RequestStatus.FAIL;
		const response = await Runtime.jsonRequest({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistTitle.persistQuery,
				variables: <SaveMediaListEntry>{
					mediaId: this.id,
					status: this.status,
					score: this.score !== undefined && this.score > 0 ? this.score : undefined,
					progress: this.progress.chapter,
					progressVolumes: this.progress.volume,
					startedAt: AnilistTitle.dateToAnilist(this.start),
					completedAt: AnilistTitle.dateToAnilist(this.end),
				},
			}),
		});
		return Runtime.responseStatus(response);
	};

	delete = async (): Promise<RequestStatus> => {
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
		return RequestStatus.SUCCESS;
	};

	static toStatus = (status: AnilistStatus): Status => {
		switch (status) {
			case AnilistStatus.NONE:
				return Status.NONE;
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
	};

	toTitle = (): Title | undefined => {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { al: this.id as number },
			progress: this.progress,
			status: AnilistTitle.toStatus(this.status),
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			start: this.start ? this.start.getTime() : undefined,
			end: this.end ? this.end.getTime() : undefined,
			name: this.name,
		});
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

	static fromTitle = <T extends ServiceTitle<T> = AnilistTitle>(title: Title): AnilistTitle | undefined => {
		if (!title.services.al) return undefined;
		return new AnilistTitle(title.services.al, {
			progress: title.progress,
			status: AnilistTitle.fromStatus(title.status),
			score: title.score ? title.score : undefined,
			start: title.start ? new Date(title.start) : undefined,
			end: title.end ? new Date(title.end) : undefined,
			name: title.name,
		});
	};
}

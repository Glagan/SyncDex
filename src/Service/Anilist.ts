import { Service, ServiceName, ServiceKey, Status } from '../Service';
import { Options } from '../Options';
import { Runtime, JSONResponse, RequestStatus } from '../Runtime';
import { ServiceTitle, Title } from '../Title';
import { Progress } from '../interfaces';

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

export class Anilist extends Service {
	key: ServiceKey = ServiceKey.Anilist;
	name: ServiceName = ServiceName.Anilist;
	static APIUrl: string = 'https://graphql.anilist.co';
	static LoginQuery: string = `query { Viewer { id } }`;
	static LoggedHeaders = (): AnilistHeaders => {
		return {
			Authorization: `Bearer ${Options.tokens.anilistToken}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		};
	};

	loggedIn = async (): Promise<RequestStatus> => {
		if (!Options.tokens.anilistToken === undefined) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			method: 'POST',
			url: Anilist.APIUrl,
			isJson: true,
			headers: Anilist.LoggedHeaders(),
			body: JSON.stringify({ query: Anilist.LoginQuery }),
		});
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		return RequestStatus.SUCCESS;
	};
}

export class AnilistTitle extends ServiceTitle {
	id: number;
	mangaDex?: number;

	progress: Progress = {
		chapter: 0,
	};
	status: AnilistStatus = AnilistStatus.NONE;
	start?: Date;
	end?: Date;
	// TODO: scoreType ?
	score: number = 0;
	name?: string;

	static getQuery = `
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
	static persistQuery = `
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

	constructor(id: number, title?: Partial<AnilistTitle>) {
		super();
		this.id = id;
		if (title !== undefined) {
			Object.assign(this, title);
		}
	}

	static dateFromAnilist = (date: AnilistDate): Date | undefined => {
		if (date.day !== null && date.month !== null && date.year !== null) {
			return new Date(date.year, date.month, date.day);
		}
		return undefined;
	};

	get = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<JSONResponse>({
			url: Anilist.APIUrl,
			method: 'POST',
			isJson: true,
			headers: Anilist.LoggedHeaders(),
			body: JSON.stringify({
				query: AnilistTitle.getQuery,
				variables: {
					mediaId: this.id,
				},
			}),
		});
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		// Convert Response to AnilistTitle
		const body = response.body as AnilistGetResponse;
		const mediaEntry = body.data.Media.mediaListEntry;
		if (mediaEntry) {
			this.progress = {
				chapter: mediaEntry.progress,
				volume: mediaEntry.progressVolumes,
			};
			this.status = mediaEntry.status;
			this.score = mediaEntry.score ? mediaEntry.score : 0;
			this.start = AnilistTitle.dateFromAnilist(mediaEntry.startedAt);
			this.end = AnilistTitle.dateFromAnilist(mediaEntry.completedAt);
		}
		this.name = body.data.Media.title.userPreferred;
		return RequestStatus.SUCCESS;
	};

	static dateToAnilist = (date?: Date): AnilistDate | undefined => {
		if (date !== undefined) {
			return { day: date.getDate(), month: date.getMonth() + 1, year: date.getUTCFullYear() };
		}
		return undefined;
	};

	persist = async (): Promise<RequestStatus> => {
		if (this.status !== AnilistStatus.NONE) {
			const response = await Runtime.request<JSONResponse>({
				url: Anilist.APIUrl,
				method: 'POST',
				headers: Anilist.LoggedHeaders(),
				body: JSON.stringify({
					query: AnilistTitle.persistQuery,
					variables: <SaveMediaListEntry>{
						mediaId: this.id,
						status: this.status,
						score: this.score > 0 ? this.score : undefined,
						progress: this.progress.chapter,
						progressVolumes: this.progress.volume,
						startedAt: AnilistTitle.dateToAnilist(this.start),
						completedAt: AnilistTitle.dateToAnilist(this.end),
					},
				}),
			});
			if (response.status >= 500) return RequestStatus.SERVER_ERROR;
			if (response.status >= 400) return RequestStatus.BAD_REQUEST;
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		// TODO
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
			services: { al: this.id },
			progress: this.progress,
			status: AnilistTitle.toStatus(this.status),
			// TODO: Score conversion
			score: this.score > 0 ? this.score : undefined,
			start: this.start ? this.start.getTime() : undefined,
			end: this.end ? this.end.getTime() : undefined,
			name: this.name,
		});
	};

	static fromStatus = (status: Status): AnilistStatus => {
		switch (status) {
			case Status.NONE:
			case Status.WONT_READ:
				return AnilistStatus.NONE;
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
	};

	fromTitle = (title: Title): this => {
		this.progress = title.progress;
		this.status = AnilistTitle.fromStatus(title.status);
		this.name = title.name;
		if (title.score !== undefined) this.score = title.score;
		if (title.start !== undefined) this.start = new Date(title.start);
		if (title.end !== undefined) this.end = new Date(title.end);
		return this;
	};
}

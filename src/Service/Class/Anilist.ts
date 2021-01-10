import { Service, LoginMethod } from '../../Core/Service';
import { Runtime } from '../../Core/Runtime';
import { Title } from '../../Core/Title';
import { Options } from '../../Core/Options';
import { AppendableElement, DOM } from '../../Core/DOM';
import { log, LogExecTime } from '../../Core/Log';
import { ActivableKey } from '../Keys';
import { ServiceName } from '../Names';

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

export class Anilist extends Service {
	name = ServiceName.Anilist;
	key = ActivableKey.Anilist;
	activable = true;

	loginMethod = LoginMethod.EXTERNAL;
	loginUrl = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';

	async loggedIn(): Promise<RequestStatus> {
		if (Options.tokens.anilistToken === undefined) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest({
			method: 'POST',
			url: AnilistAPI,
			headers: AnilistHeaders(),
			body: JSON.stringify({ query: `query { Viewer { id } }` }),
		});
		return Runtime.responseStatus(response);
	}

	@LogExecTime
	async get(key: MediaKey): Promise<AnilistTitle | RequestStatus> {
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
	}

	async logout(): Promise<void> {
		delete Options.tokens.anilistToken;
	}

	link(key: MediaKey) {
		return `https://anilist.co/manga/${key.id}`;
	}

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

	idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?anilist\.co\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return { id: parseInt(regexp[1]) };
		return { id: 0 };
	};
}

export class AnilistTitle extends Title {
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

	mediaEntryId?: number;

	static dateFromAnilist = (date: AnilistDate): Date | undefined => {
		if (date.day !== null && date.month !== null && date.year !== null) {
			return new Date(date.year, Math.max(0, date.month - 1), date.day);
		}
		return undefined;
	};

	static dateToAnilist = (date?: Date): AnilistDate | null => {
		if (date !== undefined) {
			return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
		}
		return null;
	};

	persist = async (): Promise<RequestStatus> => {
		if (!Options.tokens.anilistToken) return RequestStatus.MISSING_TOKEN;
		if (this.status === Status.NONE) {
			await log(`Could not sync Anilist: status ${this.status}`);
			return RequestStatus.BAD_REQUEST;
		}
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
		if (!this.inList || !this.mediaEntryId) {
			await log(`Could not sync Anilist: status ${this.status}`);
			return RequestStatus.BAD_REQUEST;
		}
		const response = await Runtime.jsonRequest({
			url: AnilistAPI,
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistTitle.deleteQuery,
				variables: { id: this.mediaEntryId },
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
}

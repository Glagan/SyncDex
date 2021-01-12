import { log, LogExecTime } from '../../Core/Log';
import { Options } from '../../Core/Options';
import { Runtime } from '../../Core/Runtime';
import { LoginMethod, Service } from '../../Core/Service';
import { Title } from '../../Core/Title';
import { ActivableKey } from '../Keys';
import { ServiceName } from '../Names';

interface KitsuHeaders {
	Accept: string;
	'Content-Type': string;
	Authorization: string;
	[key: string]: string;
}

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

export interface KitsuManga {
	id: string;
	type: 'manga';
	links: {};
	attributes: {
		chapterCount: number;
		volumeCount: number;
		canonicalTitle: string;
	};
}

interface KitsuLibraryEntryAttributes {
	status: KitsuStatus;
	progress: number;
	volumesOwned: number;
	reconsuming: boolean;
	reconsumeCount: number;
	notes: string | null;
	private: boolean;
	reactionSkipped: 'unskipped' | 'skipped' | 'ignored';
	rating: string;
	ratingTwenty: number | null;
	startedAt: string | null;
	finishedAt: string | null;
	progressedAt: string | null;
}

interface KitsuLibraryEntry {
	id: string;
	type: 'libraryEntries';
	links: {};
	attributes: KitsuLibraryEntryAttributes;
	relationships: {
		manga: {
			links: {};
			data?: {
				type: 'manga';
				id: string;
			};
		};
	};
}

export interface KitsuResponse {
	data: KitsuLibraryEntry[];
	included: KitsuManga[];
	errors?: any;
	meta: {
		statusCounts: {
			current?: number;
			planned?: number;
			completed?: number;
			onHold?: number;
			dropped?: number;
		};
		count: number;
	};
	links: {};
}

interface KitsuPersistResponse {
	data: KitsuLibraryEntry;
}

export const enum KitsuStatus {
	NONE = 'none',
	READING = 'current',
	COMPLETED = 'completed',
	PAUSED = 'on_hold',
	DROPPED = 'dropped',
	PLAN_TO_READ = 'planned',
}

export const KitsuAPI = 'https://kitsu.io/api/edge/library-entries';
export const KitsuHeaders = (): KitsuHeaders => {
	return {
		Accept: 'application/vnd.api+json',
		'Content-Type': 'application/vnd.api+json',
		Authorization: `Bearer ${Options.tokens.kitsuToken}`,
	};
};

export class Kitsu extends Service {
	name = ServiceName.Kitsu;
	key = ActivableKey.Kitsu;
	activable = true;

	loginMethod = LoginMethod.FORM;
	identifierField: [string, string] = ['Email', 'email'];

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
		if (userIdResp !== RequestStatus.SUCCESS) return userIdResp;
		return RequestStatus.SUCCESS;
	};

	@LogExecTime
	async get(key: MediaKey): Promise<Title | RequestStatus> {
		if (!Options.tokens.kitsuToken || !Options.tokens.kitsuUser) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest<KitsuResponse>({
			url: `${KitsuAPI}?filter[manga_id]=${key.id}&filter[user_id]=${Options.tokens.kitsuUser}&include=manga&fields[manga]=chapterCount,volumeCount,canonicalTitle`,
			method: 'GET',
			headers: KitsuHeaders(),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		const body = response.body;
		const values: Partial<KitsuTitle> = { loggedIn: true, key: key };
		if (body.data.length == 1) {
			values.inList = true;
			const libraryEntry = body.data[0];
			values.libraryEntryId = parseInt(libraryEntry.id);
			const attributes = libraryEntry.attributes;
			values.status = KitsuTitle.toStatus(attributes.status);
			if (values.status === Status.COMPLETED) {
				values.max = {
					chapter: body.included[0].attributes.chapterCount,
					volume: body.included[0].attributes.volumeCount,
				};
			}
			values.progress = { chapter: attributes.progress };
			if (attributes.volumesOwned > 0) values.progress.volume = attributes.volumesOwned;
			// Kitsu have a 0-20 range
			if (attributes.ratingTwenty && attributes.ratingTwenty !== null) values.score = attributes.ratingTwenty * 5;
			if (attributes.startedAt && attributes.startedAt !== null) values.start = new Date(attributes.startedAt);
			if (attributes.finishedAt && attributes.finishedAt !== null) values.end = new Date(attributes.finishedAt);
			values.name = body.included[0].attributes.canonicalTitle;
		} else values.inList = false;
		return new KitsuTitle(values);
	}

	logout = async (): Promise<void> => {
		delete Options.tokens.kitsuToken;
		delete Options.tokens.kitsuUser;
	};

	link(key: MediaKey): string {
		return `https://kitsu.io/manga/${key.id}`;
	}

	idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?kitsu\.io\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return { id: parseInt(regexp[1]) };
		return { id: 0 };
	};
}

export class KitsuTitle extends Title {
	static service = new Kitsu();
	libraryEntryId?: number;

	@LogExecTime
	async persist(): Promise<RequestStatus> {
		if (!Options.tokens.kitsuToken || !Options.tokens.kitsuUser) {
			await log(`Could not sync Kitsu: token ${!!Options.tokens.kitsuToken} user ${Options.tokens.kitsuUser}`);
			return RequestStatus.MISSING_TOKEN;
		}
		if (this.status === Status.NONE) {
			await log(`Could not sync Kitsu: status ${this.status}`);
			return RequestStatus.BAD_REQUEST;
		}
		const libraryEntryId = this.libraryEntryId ? this.libraryEntryId : 0;
		const method = libraryEntryId > 0 ? 'PATCH' : 'POST';
		const url = `${KitsuAPI}${libraryEntryId > 0 ? `/${this.libraryEntryId}` : ''}`;
		// Convert 0-100 score to the 0-20 range -- round to the nearest
		const kuScore = this.score !== undefined && this.score > 0 ? Math.round(this.score / 5) : undefined;
		// Fix progress to avoid 422 Cannot exceed media length
		const progress: Progress = JSON.parse(JSON.stringify(this.progress));
		if (this.max) {
			if (this.max.chapter && this.max.chapter < this.progress.chapter) {
				progress.chapter = this.max.chapter;
			}
			if (this.progress.volume && this.max.volume && this.max.volume < this.progress.volume) {
				progress.volume = this.max.volume;
			}
		}
		const response = await Runtime.jsonRequest<KitsuPersistResponse>({
			url: url,
			method: method,
			headers: KitsuHeaders(),
			body: JSON.stringify({
				data: {
					id: this.libraryEntryId ? this.libraryEntryId : undefined,
					attributes: {
						status: KitsuTitle.fromStatus(this.status),
						progress: Math.floor(progress.chapter),
						volumesOwned: progress.volume,
						ratingTwenty: kuScore,
						startedAt: this.start !== undefined ? this.start.toISOString() : null,
						finishedAt: this.end !== undefined ? this.end.toISOString() : null,
					},
					relationships: {
						manga: {
							data: {
								type: 'manga',
								id: this.key.id,
							},
						},
						user: {
							data: {
								type: 'users',
								id: Options.tokens.kitsuUser,
							},
						},
					},
					type: 'library-entries',
				},
			}),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.libraryEntryId = parseInt(response.body.data.id);
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	}

	delete = async (): Promise<RequestStatus> => {
		if (!Options.tokens.kitsuToken || !Options.tokens.kitsuUser) return RequestStatus.MISSING_TOKEN;
		if (!this.libraryEntryId || this.libraryEntryId <= 0) {
			await log(`Could not sync Kitsu: status ${this.status} libraryEntryId ${this.libraryEntryId}`);
			return RequestStatus.BAD_REQUEST;
		}
		let response = await Runtime.request({
			url: `https://kitsu.io/api/edge/library-entries/${this.libraryEntryId}`,
			method: 'DELETE',
			headers: KitsuHeaders(),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.libraryEntryId = 0;
		this.inList = false;
		return RequestStatus.DELETED;
	};

	static toStatus = (status: KitsuStatus): Status => {
		switch (status) {
			case KitsuStatus.NONE:
				return Status.NONE;
			case KitsuStatus.READING:
				return Status.READING;
			case KitsuStatus.COMPLETED:
				return Status.COMPLETED;
			case KitsuStatus.PAUSED:
				return Status.PAUSED;
			case KitsuStatus.DROPPED:
				return Status.DROPPED;
			case KitsuStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
		}
	};

	static fromStatus = (status: Status): KitsuStatus => {
		switch (status) {
			case Status.READING:
				return KitsuStatus.READING;
			case Status.COMPLETED:
				return KitsuStatus.COMPLETED;
			case Status.PAUSED:
				return KitsuStatus.PAUSED;
			case Status.DROPPED:
				return KitsuStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return KitsuStatus.PLAN_TO_READ;
		}
		return KitsuStatus.NONE;
	};
}

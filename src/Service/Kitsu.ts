import { Options } from '../Options';
import { Runtime } from '../Runtime';
import { ServiceKeyType, ActivableName, ActivableKey, ExternalTitle } from '../Title';

interface KitsuHeaders {
	Accept: string;
	'Content-Type': string;
	Authorization: string;
	[key: string]: string;
}

export interface KitsuManga {
	id: string;
	type: 'manga';
	links: {};
	attributes: {
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

export class KitsuTitle extends ExternalTitle {
	static readonly serviceName: ActivableName = ActivableName.Kitsu;
	static readonly serviceKey: ActivableKey = ActivableKey.Kitsu;

	static link(id: ServiceKeyType): string {
		return `https://kitsu.io/manga/${id}`;
	}

	id: number;
	libraryEntryId: number;

	constructor(id: ServiceKeyType, title?: Partial<KitsuTitle>) {
		super(title);
		if (typeof id !== 'number') throw 'Kitsu ID can only be a number';
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : Status.NONE;
		this.libraryEntryId = title && title.libraryEntryId !== undefined ? title.libraryEntryId : 0;
	}

	// abstract static get(id): RequestStatus
	static get = async (id: ServiceKeyType): Promise<ExternalTitle | RequestStatus> => {
		if (!Options.tokens.kitsuToken || !Options.tokens.kitsuUser) return RequestStatus.MISSING_TOKEN;
		const response = await Runtime.jsonRequest<KitsuResponse>({
			url: `${KitsuAPI}?filter[manga_id]=${id}&filter[user_id]=${Options.tokens.kitsuUser}&include=manga&fields[manga]=canonicalTitle`,
			method: 'GET',
			headers: KitsuHeaders(),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		const body = response.body;
		const values: Partial<KitsuTitle> = { loggedIn: true };
		if (body.data.length == 1) {
			values.inList = true;
			const libraryEntry = body.data[0];
			values.libraryEntryId = parseInt(libraryEntry.id);
			const attributes = libraryEntry.attributes;
			values.status = KitsuTitle.toStatus(attributes.status);
			values.progress = { chapter: attributes.progress };
			if (attributes.volumesOwned > 0) values.progress.volume = attributes.volumesOwned;
			// Kitsu have a 0-20 range
			if (attributes.ratingTwenty && attributes.ratingTwenty !== null) values.score = attributes.ratingTwenty * 5;
			if (attributes.startedAt && attributes.startedAt !== null) values.start = new Date(attributes.startedAt);
			if (attributes.finishedAt && attributes.finishedAt !== null) values.end = new Date(attributes.finishedAt);
			values.name = body.included[0].attributes.canonicalTitle;
		} else values.inList = false;
		return new KitsuTitle(id as number, values);
	};

	persist = async (): Promise<RequestStatus> => {
		if (!Options.tokens.kitsuToken || !Options.tokens.kitsuUser) return RequestStatus.MISSING_TOKEN;
		const method = this.libraryEntryId && this.libraryEntryId > 0 ? 'PATCH' : 'POST';
		const url = `${KitsuAPI}${this.libraryEntryId > 0 ? `/${this.libraryEntryId}` : ''}`;
		// Convert 0-100 score to the 0-20 range -- round to the nearest
		const kuScore = this.score !== undefined && this.score > 0 ? Math.round(this.score / 5) : undefined;
		const response = await Runtime.jsonRequest<KitsuPersistResponse>({
			url: url,
			method: method,
			headers: KitsuHeaders(),
			body: JSON.stringify({
				data: {
					id: this.libraryEntryId ? this.libraryEntryId : undefined,
					attributes: {
						status: KitsuTitle.fromStatus(this.status),
						progress: this.progress.chapter,
						volumesOwned: this.progress.volume,
						ratingTwenty: kuScore,
						startedAt: this.start !== undefined ? this.start.toISOString() : undefined,
						finishedAt: this.end !== undefined ? this.end.toISOString() : undefined,
					},
					relationships: {
						manga: {
							data: {
								type: 'manga',
								id: this.id,
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
	};

	delete = async (): Promise<RequestStatus> => {
		if (!Options.tokens.kitsuToken || !Options.tokens.kitsuUser) return RequestStatus.MISSING_TOKEN;
		if (this.libraryEntryId <= 0) return RequestStatus.BAD_REQUEST;
		let response = await Runtime.request({
			url: `https://kitsu.io/api/edge/library-entries/${this.libraryEntryId}`,
			method: 'DELETE',
			headers: KitsuHeaders(),
		});
		if (!response.ok) return Runtime.responseStatus(response);
		this.libraryEntryId = 0;
		this.inList = false;
		return RequestStatus.SUCCESS;
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

	static idFromLink = (href: string): number => {
		const regexp = /https:\/\/(?:www\.)?kitsu\.io\/manga\/(\d+)\/?/.exec(href);
		if (regexp !== null) return parseInt(regexp[1]);
		return 0;
	};

	static idFromString = (str: string): number => {
		return parseInt(str);
	};

	get mochi(): number {
		return this.id;
	}
}

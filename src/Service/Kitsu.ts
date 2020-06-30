import { Options } from '../Options';
import { Runtime, JSONResponse, RequestStatus } from '../Runtime';
import { ServiceTitle, Title } from '../Title';
import { ServiceKey, ServiceName, Status } from '../core';

interface KitsuHeaders {
	Accept: string;
	'Content-Type': string;
	Authorization: string;
	[key: string]: string;
}

export interface KitsuManga {
	id: string;
	type: 'manga';
	links: any;
	attributes: {
		canonicalTitle: string;
	};
}

export interface KitsuResponse {
	data: {
		id: string;
		type: 'libraryEntries';
		links: {
			self: string;
		};
		attributes: {
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
		};
		relationships: {
			manga: {
				links: any;
				data?: {
					type: 'manga';
					id: string;
				};
			};
		};
	}[];
	included: KitsuManga[];
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
	links: any;
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

export class KitsuTitle extends ServiceTitle<KitsuTitle> {
	readonly serviceKey: ServiceKey = ServiceKey.Kitsu;
	readonly serviceName: ServiceName = ServiceName.Kitsu;

	status: KitsuStatus = KitsuStatus.NONE;
	libraryEntryId: number = 0;

	// abstract static get(id): RequestStatus
	static get = async <T extends ServiceTitle<T> = KitsuTitle>(
		id: number | string
	): Promise<KitsuTitle | RequestStatus> => {
		const response = await Runtime.request<JSONResponse>({
			url: `${KitsuAPI}?filter[manga_id]=${id}&filter[user_id]=${Options.tokens.kitsuUser}&include=manga&fields[manga]=canonicalTitle`,
			isJson: true,
			method: 'GET',
			headers: KitsuHeaders(),
		});
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		const body = response.body as KitsuResponse;
		const values: Partial<KitsuTitle> = {};
		if (body.data.length == 1) {
			const libraryEntry = body.data[0];
			values.libraryEntryId = parseInt(libraryEntry.id);
			const attributes = libraryEntry.attributes;
			values.progress = {
				chapter: attributes.progress,
				volume: attributes.volumesOwned,
			};
			status = attributes.status;
			if (attributes.ratingTwenty !== null) values.score = attributes.ratingTwenty;
			if (attributes.startedAt !== null) values.start = new Date(attributes.startedAt);
			if (attributes.finishedAt !== null) values.end = new Date(attributes.finishedAt);
			values.name = body.included[0].attributes.canonicalTitle;
		}
		return new KitsuTitle(id, values);
	};

	persist = async (): Promise<RequestStatus> => {
		const method = this.libraryEntryId && this.libraryEntryId > 0 ? 'PATCH' : 'POST';
		const url = `${KitsuAPI}${this.libraryEntryId !== undefined ? `/${this.libraryEntryId}` : ''}`;
		const response = await Runtime.request<JSONResponse>({
			url: url,
			method: method,
			headers: KitsuHeaders(),
			body: JSON.stringify({
				data: {
					id: this.libraryEntryId,
					attributes: {
						status: this.status,
						progress: this.progress.chapter,
						volumesOwned: this.progress.volume,
						ratingTwenty: this.score !== undefined && this.score > 0 ? this.score : undefined,
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
		if (response.status >= 500) return RequestStatus.SERVER_ERROR;
		if (response.status >= 400) return RequestStatus.BAD_REQUEST;
		// TODO: Get libraryEntryId if it was a new title
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		// TODO
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

	toTitle = (): Title | undefined => {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { al: this.id as number },
			progress: this.progress,
			status: KitsuTitle.toStatus(this.status),
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			start: this.start ? this.start.getTime() : undefined,
			end: this.end ? this.end.getTime() : undefined,
			name: this.name,
		});
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

	static fromTitle = <T extends ServiceTitle<T> = KitsuTitle>(title: Title): KitsuTitle | undefined => {
		if (!title.services.ku) return undefined;
		return new KitsuTitle(title.services.ku, {
			progress: title.progress,
			status: KitsuTitle.fromStatus(title.status),
			score: title.score ? title.score : undefined,
			start: title.start ? new Date(title.start) : undefined,
			end: title.end ? new Date(title.end) : undefined,
			name: title.name,
		});
	};
}

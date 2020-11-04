import { DOM } from '../Core/DOM';
import { duration, ExportModule, ImportModule } from '../Core/Module';
import { ModuleInterface } from '../Core/ModuleInterface';
import { Options } from '../Core/Options';
import { Runtime } from '../Core/Runtime';
import { ActivableKey, ActivableName, LoginMethod, Service, Services } from '../Core/Service';
import { ExternalTitle, ExternalTitles, FoundTitle, LocalTitle } from '../Core/Title';

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

export class KitsuImport extends ImportModule {
	constructor(moduleInterface?: ModuleInterface) {
		super(Kitsu, moduleInterface);
	}

	findManga = (included: KitsuManga[], id: string): KitsuManga => {
		for (const manga of included) {
			if (manga.id == id) return manga;
		}
		return included[0]; // never
	};

	execute = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Fetching all titles...' });
		const message = this.interface?.message('loading', [progress]);

		// Get each pages
		let lastPage = false;
		let current = 1;
		let max = 1;
		while (!lastPage) {
			progress.textContent = `Fetching all titles... Page ${current} out of ${max}.`;
			const response = await Runtime.jsonRequest<KitsuResponse>({
				url: `${KitsuAPI}?
						filter[user_id]=${Options.tokens.kitsuUser}&
						filter[kind]=manga&
						fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,startedAt,finishedAt,manga&
						include=manga&
						fields[manga]=chapterCount,volumeCount,canonicalTitle&
						page[limit]=500&
						page[offset]=${(current - 1) * 500}`,
				headers: KitsuHeaders(),
			});
			if (!response.ok) {
				this.interface?.message('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			if (response.body.errors !== undefined) {
				this.interface?.message(
					'warning',
					'The Request failed, check if you are logged in and your token is valid or retry later.'
				);
				return false;
			}
			const body = response.body;
			// Each row has a data-id field
			for (const title of body.data) {
				if (!title.relationships.manga.data) continue;
				const manga = this.findManga(body.included, title.relationships.manga.data.id);
				const foundTitle: FoundTitle = {
					key: { id: parseInt(title.relationships.manga.data.id) },
					progress: {
						chapter: title.attributes.progress,
						volume: title.attributes.volumesOwned,
					},
					max: {
						chapter: manga.attributes.chapterCount,
						volume: manga.attributes.volumeCount,
					},
					status: KitsuTitle.toStatus(title.attributes.status),
					score: title.attributes.ratingTwenty !== null ? title.attributes.ratingTwenty * 5 : 0,
					start: title.attributes.startedAt ? new Date(title.attributes.startedAt) : undefined,
					end: title.attributes.finishedAt ? new Date(title.attributes.finishedAt) : undefined,
					name: manga.attributes.canonicalTitle,
					mochi: parseInt(title.relationships.manga.data.id),
				};
				if (foundTitle.status === Status.COMPLETED) {
					foundTitle.max = {
						chapter: manga.attributes.chapterCount,
						volume: manga.attributes.volumeCount,
					};
				}
				this.found.push(foundTitle);
			}

			// We get 500 entries per page
			max = Math.ceil(body.meta.count / 500);
			lastPage = current >= max;
			current++;
		}
		message?.classList.remove('loading');

		return true;
	};
}

export class KitsuExport extends ExportModule {
	onlineList: { [key: string]: number | undefined } = {};

	constructor(moduleInterface?: ModuleInterface) {
		super(Kitsu, moduleInterface);
	}

	preExecute = async (titles: LocalTitle[]): Promise<boolean> => {
		const message = this.interface?.message('loading', 'Checking current status of each titles...');
		let max = Math.ceil(titles.length / 500);
		for (let current = 1; current <= max; current++) {
			const ids = titles.slice((current - 1) * 500, current * 500).map((title) => title.services.ku!.id!);
			const response = await Runtime.jsonRequest<KitsuResponse>({
				url: `${KitsuAPI}
					?filter[user_id]=${Options.tokens.kitsuUser}
					&filter[mangaId]=${ids.join(',')}
					&fields[libraryEntries]=id,manga
					&include=manga
					&fields[manga]=id
					&page[limit]=500`,
				headers: KitsuHeaders(),
			});
			if (!response.ok) {
				message?.classList.remove('loading');
				this.interface?.message('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			const body = response.body;
			for (const title of body.data) {
				if (title.relationships.manga.data) {
					this.onlineList[title.relationships.manga.data.id] = +title.id;
				}
			}
		}
		message?.classList.remove('loading');
		return true;
	};

	execute = async (titles: LocalTitle[]): Promise<boolean> => {
		const max = titles.length;
		this.interface?.message('default', `Exporting ${max} Titles...`);
		const progress = DOM.create('p');
		const message = this.interface?.message('loading', [progress]);
		let average = 0;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const localTitle = titles[current];
			let failed = false;
			let currentProgress = `Exporting Title ${current}/${max} (${localTitle.name})...`;
			if (average > 0) currentProgress += `\nEstimated time remaining: ${duration((max - current) * average)}.`;
			progress.textContent = currentProgress;
			// Kitsu require a libraryEntryId to update a Title
			const libraryEntryId = this.onlineList[localTitle.services.ku!.id!];
			if (libraryEntryId) {
				const before = Date.now();
				const title = new KitsuTitle({ ...localTitle, key: localTitle.services[ActivableKey.AnimePlanet] });
				title.libraryEntryId = libraryEntryId;
				const response = await title.persist();
				if (average == 0) average = Date.now() - before;
				else average = (average + (Date.now() - before)) / 2;
				if (response) this.summary.valid++;
				else failed = true;
			} else failed = false;
			if (failed) this.summary.failed.push(localTitle.name ?? `#${localTitle.key.id}`);
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
	};
}

export class Kitsu extends Service {
	static readonly serviceName: ActivableName = ActivableName.Kitsu;
	static readonly serviceKey: ActivableKey = ActivableKey.Kitsu;

	static loginMethod: LoginMethod = LoginMethod.FORM;

	static importModule = (moduleInterface?: ModuleInterface) => new KitsuImport(moduleInterface);
	static exportModule = (moduleInterface?: ModuleInterface) => new KitsuExport(moduleInterface);

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

	logout = async (): Promise<void> => {
		delete Options.tokens.kitsuToken;
		delete Options.tokens.kitsuUser;
	};

	static link(key: MediaKey): string {
		return `https://kitsu.io/manga/${key.id}`;
	}
}

Services[ActivableKey.Kitsu] = Kitsu;

export class KitsuTitle extends ExternalTitle {
	static service = Kitsu;
	libraryEntryId: number = 0;

	// abstract static get(id): RequestStatus
	static get = async (key: MediaKey): Promise<ExternalTitle | RequestStatus> => {
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
						progress: Math.floor(this.progress.chapter),
						volumesOwned: this.progress.volume,
						ratingTwenty: kuScore,
						startedAt: this.start !== undefined ? this.start.toISOString() : undefined,
						finishedAt: this.end !== undefined ? this.end.toISOString() : undefined,
					},
					relationships: {
						manga: {
							data: {
								type: 'manga',
								id: this.key,
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

	static idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?kitsu\.io\/manga\/(\d+)\/?/.exec(href);
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

ExternalTitles[ActivableKey.Kitsu] = KitsuTitle;

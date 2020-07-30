import { LocalStorage } from './Storage';
import { Options, AvailableOptions } from './Options';
import { RequestStatus } from './Runtime';
import { DOM } from './DOM';
import { dateFormat, dateCompare } from './Utility';
import { GetService } from './Service';

export const StatusMap: { [key in Status]: string } = {
	[Status.NONE]: 'None',
	[Status.READING]: 'Reading',
	[Status.COMPLETED]: 'Completed',
	[Status.PAUSED]: 'Paused',
	[Status.PLAN_TO_READ]: 'Plan to Read',
	[Status.DROPPED]: 'Dropped',
	[Status.REREADING]: 'Re-reading',
	[Status.WONT_READ]: "Won't Read",
};

export enum StaticName {
	'MyMangaDex' = 'MyMangaDex',
	'SyncDex' = 'SyncDex',
	'MangaDex' = 'MangaDex',
}

export enum ActivableName {
	'MyAnimeList' = 'MyAnimeList',
	'MangaUpdates' = 'MangaUpdates',
	'Anilist' = 'Anilist',
	'Kitsu' = 'Kitsu',
	'AnimePlanet' = 'AnimePlanet',
}

export const ServiceName = {
	...StaticName,
	...ActivableName,
};
export type ServiceName = StaticName | ActivableName;

export enum StaticKey {
	'MyMangaDex' = 'mmd',
	'SyncDex' = 'sc',
	'MangaDex' = 'md',
}

export enum ActivableKey {
	'MyAnimeList' = 'mal',
	'MangaUpdates' = 'mu',
	'Anilist' = 'al',
	'Kitsu' = 'ku',
	'AnimePlanet' = 'ap',
}

export const ServiceKey = {
	...StaticKey,
	...ActivableKey,
};
export type ServiceKey = StaticKey | ActivableKey;

export interface ServiceKeyMap {
	[ServiceKey.MyMangaDex]: number;
	[ServiceKey.SyncDex]: number;
	[ServiceKey.MangaDex]: number;
	[ServiceKey.MyAnimeList]: number;
	[ServiceKey.MangaUpdates]: number;
	[ServiceKey.Anilist]: number;
	[ServiceKey.Kitsu]: number;
	[ServiceKey.AnimePlanet]: AnimePlanetReference;
}

export type ServiceList = { [key in ActivableKey]?: ServiceKeyMap[key] };
export type ServiceKeyType = number | string | AnimePlanetReference;

export const ReverseActivableName: { [key in ActivableKey]: ActivableName } = (() => {
	const res: Partial<{ [key in ActivableKey]: ActivableName }> = {};
	for (const key in ActivableKey) {
		res[ActivableKey[key as ActivableName] as ActivableKey] = key as ActivableName;
	}
	return res as { [key in ActivableKey]: ActivableName };
})();

export const ReverseServiceName: { [key in ServiceKey]: ServiceName } = (() => {
	const res: Partial<{ [key in ServiceKey]: ServiceName }> = {};
	for (const key in ServiceKey) {
		res[ServiceKey[key as ServiceName] as ServiceKey] = key as ServiceName;
	}
	return res as { [key in ServiceKey]: ServiceName };
})();

interface SaveProgress {
	c: number;
	v?: number;
}

export interface StorageTitle {
	s: ServiceList; // services
	st: Status; // status
	sc?: number; // score
	p: SaveProgress; // progress
	c?: number[]; // chapters
	sd?: number; // start
	ed?: number; // end
	lt?: number; // lastTitle
	lc?: number; // lastCheck
	n?: string; // name
	// History
	id?: number; // lastChapter
	h?: SaveProgress; // history
	hi?: number; // highest
	lr?: number; // lastRead
}

export interface TitleProperties {
	inList: boolean;
	synced: boolean;
	status: Status;
	score: number;
	progress: Progress;
	start?: Date;
	end?: Date;
	name?: string;
}

export interface LocalTitleProperties {
	services: ServiceList;
	chapters: number[];
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	history?: Progress;
	highest?: number;
	lastRead?: number;
}

export interface ExternalTitleProperties {
	loggedIn: boolean;
	mangaDex?: number;
}

export type ExportOptions = {
	options?: AvailableOptions;
};

export type ExportHistory = {
	history?: number[];
};

export type ExportedTitles = {
	[key: string]: StorageTitle;
};

export type ExportedSave = ExportOptions & ExportHistory & ExportedTitles;

export class StorageTitle {
	static valid(title: StorageTitle): boolean {
		return (
			typeof title.s === 'object' &&
			typeof title.st === 'number' &&
			typeof title.p === 'object' &&
			title.p.c !== undefined &&
			(title.sc === undefined || typeof title.sc === 'number') &&
			(title.c === undefined || Array.isArray(title.c)) &&
			(title.sd === undefined || typeof title.sd === 'number') &&
			(title.ed === undefined || typeof title.ed === 'number') &&
			(title.lt === undefined || typeof title.lt === 'number') &&
			(title.lc === undefined || typeof title.lc === 'number') &&
			(title.id === undefined || typeof title.id === 'number') &&
			(title.h === undefined || (typeof title.h === 'object' && title.h.c !== undefined)) &&
			(title.hi === undefined || typeof title.hi === 'number') &&
			(title.lr === undefined || typeof title.lr === 'number') &&
			(title.n === undefined || typeof title.n === 'string')
		);
	}
}

export type MissableField = 'score' | 'start' | 'end';

export abstract class Title implements TitleProperties, ExternalTitleProperties {
	static readonly serviceName: ServiceName;
	static readonly serviceKey: ServiceKey;

	abstract id: ServiceKeyType;
	inList: boolean = false;
	synced: boolean = false;
	status: Status = Status.NONE;
	progress: Progress = { chapter: 0 };
	score: number = 0;
	start?: Date;
	end?: Date;
	name?: string;
	loggedIn: boolean = false;
	mangaDex?: number;

	static readonly missingFields: MissableField[] = [];
	static readonly missingFieldsMap: { [key in MissableField]: string } = {
		start: 'Start Date',
		end: 'Finish Date',
		score: 'Score',
	};

	/**
	 * Send any necessary requests to save the Media on the Service.
	 */
	abstract persist(): Promise<RequestStatus>;

	/**
	 * Send any necessary requests to delete the Media on the Service.
	 */
	abstract delete(): Promise<RequestStatus>;

	/**
	 * Pull the current status of the Media identified by ID.
	 * Return a `RequestStatus` on error.
	 */
	static get = async (id: ServiceKeyType): Promise<Title | RequestStatus> => {
		throw 'Title.get is an abstract function';
	};

	overviewRow = (icon: string, content: string): HTMLElement => {
		return DOM.create('div', {
			class: icon == 'ban' ? 'helper' : undefined,
			childs: [
				DOM.create('i', { class: `fas fa-${icon}` }),
				DOM.space(),
				DOM.create('span', { textContent: content }),
			],
		});
	};

	/**
	 * Create a list of all values for the Media.
	 */
	overview = (parent: HTMLElement): void => {
		if (!this.loggedIn) {
			parent.appendChild(
				DOM.create('div', {
					class: 'alert alert-danger',
					textContent: 'You are not Logged In.',
				})
			);
			return;
		}
		if (this.inList) {
			const missingFields = (<typeof Title>this.constructor).missingFields;
			const rows: HTMLElement[] = [
				DOM.create('div', { class: `status st${this.status}`, textContent: StatusMap[this.status] }),
			];
			if (this.progress.volume) rows.push(this.overviewRow('book', `Volume ${this.progress.volume}`));
			rows.push(this.overviewRow('bookmark', `Chapter ${this.progress.chapter}`));
			if (this.start) {
				rows.push(this.overviewRow('calendar-plus', dateFormat(this.start)));
			} else if (missingFields.indexOf('start') < 0) {
				rows.push(this.overviewRow('calendar-plus', 'No Start Date'));
			}
			if (this.end) {
				rows.push(this.overviewRow('calendar-check', dateFormat(this.end)));
			} else if (missingFields.indexOf('end') < 0) {
				rows.push(this.overviewRow('calendar-check', 'No Finish Date'));
			}
			if (this.score) rows.push(this.overviewRow('star', `Scored ${this.score} out of 100`));
			else if (missingFields.indexOf('score') < 0) rows.push(this.overviewRow('star', `Not Scored yet`));
			for (const missingField of missingFields) {
				rows.push(
					this.overviewRow(
						'ban',
						`No ${Title.missingFieldsMap[missingField]} available on ${
							(<typeof Title>this.constructor).serviceName
						}`
					)
				);
			}
			DOM.append(parent, ...rows);
		} else DOM.append(parent, DOM.text('Not in List.'));
	};

	isMoreRecent = (title: Title): boolean => {
		return (
			this.progress.chapter > title.progress.chapter ||
			(this.progress.volume !== undefined && title.progress.volume === undefined) ||
			(this.progress.volume && title.progress.volume && this.progress.volume > title.progress.volume) ||
			(title.score == 0 && this.score !== undefined && this.score > 0) ||
			(this.start !== undefined && (title.start === undefined || title.start > this.start)) ||
			(this.end !== undefined && (title.end === undefined || title.end > this.end))
		);
	};

	/**
	 * Compare the Media on the Service to a Title to check if it has the same progress.
	 * Avoid checking fields that cannot exist on the Service.
	 */
	isSynced = (title: Title): boolean => {
		const missingFields = (<typeof Title>this.constructor).missingFields;
		return (this.synced =
			title.status === this.status &&
			title.progress.chapter === this.progress.chapter &&
			title.progress.volume === this.progress.volume &&
			(missingFields.indexOf('score') >= 0 || title.score === this.score) &&
			(missingFields.indexOf('start') >= 0 ||
				(title.start === undefined && this.start === undefined) ||
				(title.start !== undefined && this.start !== undefined && dateCompare(title.start, this.start))) &&
			(missingFields.indexOf('end') >= 0 ||
				(title.end === undefined && this.end === undefined) ||
				(title.end !== undefined && this.end !== undefined && dateCompare(title.end, this.end))));
	};

	/**
	 * Assign all values from the Title to *this*.
	 */
	import = (title: Title): void => {
		this.synced = true;
		this.status = title.status;
		this.progress.chapter = title.progress.chapter;
		if (title.progress.volume) {
			this.progress.volume = title.progress.volume;
		} else delete this.progress.volume;
		const missingFields = (<typeof Title>this.constructor).missingFields;
		if (missingFields.indexOf('score') < 0) this.score = title.score;
		if (missingFields.indexOf('start') < 0 && title.start) {
			this.start = new Date(title.start);
		} else delete this.start;
		if (missingFields.indexOf('end') < 0 && title.end) {
			this.end = new Date(title.end);
		} else delete this.end;
	};

	/**
	 * Select all higher (or lower for dates) values from both Titles and assign them to *this*.
	 * Score is always export to the Title if it exists.
	 */
	merge = (title: Title): void => {
		this.synced = true;
		this.status = title.status;
		if (title.progress.chapter > this.progress.chapter) {
			this.progress.chapter = title.progress.chapter;
		}
		if (title.progress.volume && (!this.progress.volume || title.progress.volume > this.progress.volume)) {
			this.progress.volume = title.progress.volume;
		}
		const missingFields = (<typeof Title>title.constructor).missingFields;
		if (missingFields.indexOf('score') < 0 && title.score !== undefined) {
			this.score = title.score;
		}
		if (missingFields.indexOf('start') < 0 && title.start && (!this.start || title.start < this.start)) {
			this.start = new Date(title.start);
		}
		if (missingFields.indexOf('end') < 0 && title.end && (!this.end || title.end < this.end)) {
			this.end = new Date(title.end);
		}
		if (this.name && this.name != '') title.name = title.name;
	};

	/**
	 * Link to a single Media page.
	 */
	static link = (id: ServiceKeyType): string => {
		return '#';
	};

	link(): string {
		return (<typeof Title>this.constructor).link(this.id);
	}
}

export class LocalTitle extends Title implements LocalTitleProperties {
	static readonly serviceName: ServiceName = StaticName.SyncDex;
	static readonly serviceKey: ServiceKey = StaticKey.SyncDex;

	id: number;

	/**
	 * `ServiceKey` list of mapped Service for the Title.
	 */
	services: ServiceList = {};

	/**
	 * List of all read Chapters.
	 */
	chapters: number[] = [];

	/**
	 * Last time the Title page of the Title was visited.
	 */
	lastTitle?: number;
	/**
	 * Last time the Title was synced with an external Service
	 */
	lastCheck?: number;

	// History

	/**
	 * MangaDex Chapter ID of the last read chapter.
	 */
	lastChapter?: number;
	/**
	 * Displayed Chapter/Volume in the History page.
	 * This Progress is the last read chapter without looking at any options.
	 */
	history?: Progress;
	/**
	 * Highest read chapter on MangaDex
	 */
	highest?: number;
	/**
	 * Last time a Chapter was read for the Title
	 */
	lastRead?: number;

	constructor(id: number, title?: Partial<LocalTitleProperties & TitleProperties>) {
		super();
		this.id = id;
		this.inList = title !== undefined;
		this.synced = true;
		this.loggedIn = true;
		if (title != undefined) Object.assign(this, title);
	}

	/**
	 * Convert a SaveTitle to a full length Title
	 */
	static fromSave(title: StorageTitle): LocalTitleProperties & TitleProperties {
		const mapped: LocalTitleProperties & TitleProperties = {
			inList: true,
			synced: true,
			services: title.s,
			progress: {
				chapter: title.p.c,
				volume: title.p.v,
			},
			status: title.st,
			score: title.sc || 0,
			chapters: title.c || [],
			start: title.sd ? new Date(title.sd) : undefined,
			end: title.ed ? new Date(title.ed) : undefined,
			lastTitle: title.lt,
			lastCheck: title.lc,
			lastChapter: title.id,
			highest: title.hi,
			name: title.n,
			lastRead: title.lr,
		};
		if (title.h) {
			mapped.history = {
				chapter: title.h.c,
				volume: title.h.v,
			};
		}
		return mapped;
	}

	/**
	 * Retrieve a Title by it's MangaDex ID from Local Storage.
	 */
	static async get(id: ServiceKeyType): Promise<LocalTitle> {
		if (typeof id !== 'number' && typeof id !== 'string') throw 'LocalTitle.id need to be a number or a string.';
		const title: StorageTitle | undefined = await LocalStorage.get<StorageTitle>(id);
		const rid = typeof id === 'number' ? id : parseInt(id);
		if (title === undefined) {
			return new LocalTitle(rid);
		}
		return new LocalTitle(rid, LocalTitle.fromSave(title));
	}

	/**
	 * Convert a Title to a `SaveTitle` with reduced key length.
	 * All keys with no value or empty value are not saved.
	 */
	toSave = (): StorageTitle => {
		const mapped: StorageTitle = {
			s: this.services,
			st: this.status,
			sc: this.score > 0 ? this.score : undefined,
			p: {
				c: this.progress.chapter,
				v: this.progress.volume && this.progress.volume > 0 ? this.progress.volume : undefined,
			},
			lt: this.lastTitle,
			lc: this.lastCheck,
			id: this.lastChapter,
			hi: this.highest,
			n: this.name,
			lr: this.lastRead,
		};
		if (this.start) mapped.sd = this.start.getTime();
		if (this.end) mapped.ed = this.end.getTime();
		if (this.chapters.length > 0) {
			mapped.c = this.chapters;
		}
		if (this.history) {
			mapped.h = {
				c: this.history.chapter,
				v: this.history.volume,
			};
		}
		return mapped;
	};

	/**
	 * Convert a Title to a SaveTitle to follow the save schema and save it in LocalStorage
	 */
	persist = async (): Promise<RequestStatus> => {
		await LocalStorage.set(this.id as number | string, this.toSave());
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		await LocalStorage.remove(this.id as number | string);
		return RequestStatus.SUCCESS;
	};

	/**
	 * Select highest values of both Titles and assign them to the receiving Title.
	 */
	localMerge = (other: LocalTitle): void => {
		this.merge(other);
		// Update all 'number' properties to select the highest ones -- except for dates
		for (let k in this) {
			const key = k as keyof LocalTitle;
			if (this[key] && other[key] && typeof this[key] === 'number' && typeof other[key] === 'number') {
				Object.assign(this, { [key]: Math.max(this[key] as number, other[key] as number) });
			}
		}
		Object.assign(this.services, other.services); // Merge Services -- other erase *this*
		// Merge chapters array
		this.chapters = this.chapters.concat(other.chapters);
		// Sort and only keep the first (desc) *Options.chaptersSaved* chapters
		this.chapters.sort((a, b) => b - a);
		if (this.chapters.length > Options.chaptersSaved) {
			const diff = Options.chaptersSaved - this.chapters.length;
			this.chapters.splice(-diff, diff);
		}
	};

	static link = (id: ServiceKeyType): string => {
		return `https://mangadex.org/title/${id}`;
	};

	toExternal = (key: ActivableKey): ExternalTitle | undefined => {
		if (this.services[key] === undefined) return undefined;
		const Service = GetService(ReverseActivableName[key]);
		return new Service(this.services[key]!, {
			progress: this.progress,
			status: this.status,
			score: this.score ? this.score : undefined,
			start: this.start ? new Date(this.start) : undefined,
			end: this.end ? new Date(this.end) : undefined,
			name: this.name,
		});
	};
}

export abstract class ExternalTitle extends Title {
	static readonly serviceName: ActivableName;
	static readonly serviceKey: ActivableKey;

	constructor(title?: Partial<ExternalTitle>) {
		super();
		if (title !== undefined) Object.assign(this, title);
	}

	/**
	 * Get the ID used by Mochi that can only be a number or a string.
	 */
	abstract get mochi(): number | string;

	toLocalTitle = (): LocalTitle | undefined => {
		if (!this.mangaDex) return undefined;
		return new LocalTitle(this.mangaDex, {
			inList: this.inList,
			synced: this.synced,
			services: { [(<typeof ExternalTitle>this.constructor).serviceKey]: this.id },
			chapters: [],
			progress: this.progress,
			status: this.status,
			score: this.score,
			start: this.start ? this.start : undefined,
			end: this.end ? this.end : undefined,
			name: this.name,
		});
	};
}

export class TitleCollection {
	collection: LocalTitle[] = [];

	constructor(titles: LocalTitle[] = []) {
		this.collection = titles;
	}

	/**
	 * Add Title(s) to the Collection.
	 */
	add = (...title: LocalTitle[]): void => {
		this.collection.push(...title);
	};

	remove = (id: number): void => {
		const index = this.collection.findIndex((t) => t.id == id);
		if (index !== undefined) {
			this.collection.splice(index, 1);
		}
	};

	/**
	 * List of all MangaDex IDs in the Collection.
	 */
	get ids(): number[] {
		return this.collection.map((title) => {
			return title.id;
		});
	}

	/**
	 * The length of the Collection.
	 */
	get length(): number {
		return this.collection.length;
	}

	/**
	 * Retrieve all Titles with the IDs inside `list` inside a Collection.
	 * If `list` is undefined, return all Titles in Local Storage.
	 */
	static async get(list?: number[] | string[]): Promise<TitleCollection> {
		let collection = new TitleCollection();
		if (list === undefined) {
			const localTitles = (await LocalStorage.getAll()) as ExportedSave;
			for (const key in localTitles) {
				if (key !== 'options' && key != 'history') {
					collection.add(new LocalTitle(parseInt(key), LocalTitle.fromSave(localTitles[key])));
				}
			}
		} else {
			const localTitles = await LocalStorage.getAll<StorageTitle>(list);
			if (localTitles !== undefined) {
				for (const id of list) {
					const titleId = typeof id === 'number' ? id : parseInt(id);
					if (localTitles[titleId] === undefined) {
						collection.add(new LocalTitle(titleId));
					} else {
						collection.add(new LocalTitle(titleId, LocalTitle.fromSave(localTitles[titleId])));
					}
				}
			}
		}
		return collection;
	}

	/**
	 * Find the title with the MangaDex ID `id` inside the Collection.
	 */
	find = (id: number): LocalTitle | undefined => {
		for (const title of this.collection) {
			if (title.id === id) return title;
		}
		return undefined;
	};

	/**
	 * Apply merge to each Titles in the receiving Collection with the other Collection.
	 * Add missing Titles to the receiving Collection.
	 */
	merge = (other: TitleCollection): void => {
		for (const title of other.collection) {
			let found = this.find(title.id);
			if (found !== undefined) {
				found.merge(title);
			} else {
				this.add(title);
			}
		}
	};

	/**
	 * Persist the Collection to Local Storage.
	 */
	save = async (): Promise<void> => {
		const mapped: { [key: number]: StorageTitle } = {};
		for (const title of this.collection) {
			mapped[title.id] = title.toSave();
		}
		return LocalStorage.raw(mapped);
	};
}

export type ServiceTitleList = Partial<{ [key in ActivableKey]: Promise<Title | RequestStatus> }>;

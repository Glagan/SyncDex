import { LocalStorage } from './Storage';
import { Options, AvailableOptions } from './Options';
import { DOM } from './DOM';
import { dateFormat, dateCompare, isDate } from './Utility';

export const StatusMap: { [key in Status]: string } = {
	[Status.NONE]: 'No Status',
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

export function iconToService(src: string): ActivableKey | undefined {
	const key = /https:\/\/(?:www\.)?mangadex\.org\/images\/misc\/(.+)\.png/.exec(src);
	if (key == null) return undefined;
	switch (key[1]) {
		case 'mal':
		case 'al':
		case 'ap':
		case 'mu':
			return key[1] as ActivableKey;
		case 'kt':
			return ActivableKey.Kitsu;
	}
	return undefined;
}

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
			(title.id === undefined || typeof title.id === 'number') &&
			(title.h === undefined || (typeof title.h === 'object' && title.h.c !== undefined)) &&
			(title.hi === undefined || typeof title.hi === 'number') &&
			(title.lr === undefined || typeof title.lr === 'number') &&
			(title.n === undefined || typeof title.n === 'string')
		);
	}
}

export type MissableField = 'volume' | 'score' | 'start' | 'end';

export abstract class BaseTitle implements TitleProperties, ExternalTitleProperties {
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
		volume: 'Volume',
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
	static get = async (id: ServiceKeyType): Promise<BaseTitle | RequestStatus> => {
		throw 'BaseTitle.get is an abstract function';
	};

	overviewRow = <K = Date | number | string>(icon: string, name: string, content?: K, original?: K): HTMLElement => {
		const nameHeader = DOM.create('span', { textContent: name });
		const row = DOM.create('div', {
			class: icon == 'ban' ? 'helper' : undefined,
			childs: [DOM.create('i', { class: `fas fa-${icon}` }), DOM.space(), nameHeader],
		});
		// Display value
		if (content !== undefined) {
			DOM.append(
				row,
				DOM.space(),
				DOM.create('span', {
					textContent: `${isDate(content) ? dateFormat(content) : content}`,
				})
			);
			// Helper with message if there is no value
		} else nameHeader.className = 'helper';
		// Display difference between synced value
		if (
			original !== undefined &&
			(content === undefined ||
				(isDate(content) && isDate(original) && !dateCompare(content, original)) ||
				(typeof content === 'number' &&
					typeof original === 'number' &&
					Math.floor(content) != Math.floor(original)) ||
				(typeof content === 'string' && typeof original === 'string' && content != original))
		) {
			row.lastElementChild!.classList.add('not-synced');
			// Append synced value next to the not synced value
			DOM.append(
				row,
				DOM.space(),
				DOM.create('span', {
					textContent: `${
						isDate(original)
							? dateFormat(original)
							: typeof original === 'number'
							? Math.floor(original)
							: original
					}`,
					class: 'synced',
				})
			);
		}
		return row;
	};

	/**
	 * Create a list of all values for the Media.
	 */
	overview = (parent: HTMLElement, title?: BaseTitle): void => {
		if (!this.loggedIn) {
			parent.appendChild(
				DOM.create('div', {
					class: 'alert alert-danger',
					textContent: 'You are not Logged In.',
				})
			);
			return;
		}
		if (this.inList || this instanceof Title) {
			const missingFields = (<typeof BaseTitle>this.constructor).missingFields;
			const rows: HTMLElement[] = [
				DOM.create('div', { class: `status st${this.status}`, textContent: StatusMap[this.status] }),
			];
			rows.push(this.overviewRow('bookmark', 'Chapter', this.progress.chapter, title?.progress.chapter));
			if (missingFields.indexOf('volume') < 0 && this.progress.volume) {
				rows.push(this.overviewRow('book', 'Volume', this.progress.volume, title?.progress.volume));
			}
			if (this.start) {
				rows.push(this.overviewRow('calendar-plus', 'Started', this.start, title?.start));
			} else if (missingFields.indexOf('start') < 0) {
				rows.push(this.overviewRow('calendar-plus', 'No Start Date', undefined, title?.start));
			}
			if (this.end) {
				rows.push(this.overviewRow('calendar-check', 'Completed', this.end, title?.end));
			} else if (missingFields.indexOf('end') < 0) {
				rows.push(this.overviewRow('calendar-check', 'No Completion Date', undefined, title?.end));
			}
			if (this.score) {
				rows.push(
					this.overviewRow(
						'star',
						'Scored',
						`${this.score} out of 100`,
						title && title.score > 0 ? `${title.score} out of 100` : undefined
					)
				);
			} else if (missingFields.indexOf('score') < 0)
				rows.push(
					this.overviewRow(
						'star',
						'Not Scored yet',
						undefined,
						title && title.score > 0 ? `${title.score} out of 100` : undefined
					)
				);
			for (const missingField of missingFields) {
				rows.push(
					this.overviewRow(
						'ban',
						`No ${BaseTitle.missingFieldsMap[missingField]} available on ${
							(<typeof BaseTitle>this.constructor).serviceName
						}`
					)
				);
			}
			DOM.append(parent, ...rows);
		} else DOM.append(parent, DOM.text('Not in List.'));
	};

	/**
	 * Check if *this* BaseTitle is more recent that the other BaseTitle.
	 * A different score always trigger a true, since higher Services are tested last.
	 */
	isMoreRecent = (other: BaseTitle): boolean => {
		const missingFields = (<typeof BaseTitle>this.constructor).missingFields;
		return (
			this.progress.chapter > other.progress.chapter ||
			(missingFields.indexOf('volume') < 0 &&
				((this.progress.volume !== undefined && other.progress.volume === undefined) ||
					(this.progress.volume && other.progress.volume && this.progress.volume > other.progress.volume))) ||
			(missingFields.indexOf('score') < 0 && this.score > 0 && this.score != other.score) ||
			(missingFields.indexOf('start') < 0 &&
				this.start !== undefined &&
				(other.start === undefined || other.start > this.start)) ||
			(missingFields.indexOf('end') < 0 &&
				this.end !== undefined &&
				(other.end === undefined || other.end > this.end))
		);
	};

	/**
	 * Compare the Media on the Service to a Title to check if it has the same progress.
	 * Avoid checking fields that cannot exist on the Service.
	 */
	isSynced = (title: BaseTitle): boolean => {
		const missingFields = (<typeof BaseTitle>this.constructor).missingFields;
		this.synced =
			title.status === this.status &&
			Math.floor(title.progress.chapter) === Math.floor(this.progress.chapter) &&
			(missingFields.indexOf('volume') >= 0 || title.progress.volume === this.progress.volume) &&
			(missingFields.indexOf('score') >= 0 || title.score === this.score) &&
			(missingFields.indexOf('start') >= 0 ||
				(title.start === undefined && this.start === undefined) ||
				(title.start !== undefined && this.start !== undefined && dateCompare(title.start, this.start))) &&
			(missingFields.indexOf('end') >= 0 ||
				(title.end === undefined && this.end === undefined) ||
				(title.end !== undefined && this.end !== undefined && dateCompare(title.end, this.end)));
		return this.synced;
	};

	/**
	 * Assign all values from the Title to *this*.
	 */
	import = (title: BaseTitle): void => {
		const missingFields = (<typeof BaseTitle>this.constructor).missingFields;
		this.synced = true;
		this.status = title.status;
		this.progress.chapter = title.progress.chapter;
		if (missingFields.indexOf('volume') < 0 && title.progress.volume) {
			this.progress.volume = title.progress.volume;
		} else delete this.progress.volume;
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
	merge = (title: BaseTitle): void => {
		const missingFields = (<typeof BaseTitle>title.constructor).missingFields;
		this.synced = true;
		if (title.status !== Status.NONE) {
			this.status = title.status;
		}
		if (title.progress.chapter > this.progress.chapter) {
			this.progress.chapter = title.progress.chapter;
		}
		if (
			missingFields.indexOf('volume') < 0 &&
			title.progress.volume &&
			(!this.progress.volume || title.progress.volume > this.progress.volume)
		) {
			this.progress.volume = title.progress.volume;
		}
		if (missingFields.indexOf('score') < 0 && title.score !== undefined) {
			this.score = title.score;
		}
		if (missingFields.indexOf('start') < 0 && title.start && (!this.start || this.start > title.start)) {
			this.start = new Date(title.start);
		}
		if (missingFields.indexOf('end') < 0 && title.end && (!this.end || this.end > title.end)) {
			this.end = new Date(title.end);
		}
		if (this.name && this.name != '') title.name = title.name;
	};

	/**
	 * Link to a single Media page.
	 */
	static link = (id: ServiceKeyType): string => {
		throw 'BaseTitle.link is an abstract function';
	};

	link(): string {
		return (<typeof BaseTitle>this.constructor).link(this.id);
	}

	isNextChapter = (progress: Progress): boolean => {
		return progress.chapter > this.progress.chapter && progress.chapter < Math.floor(this.progress.chapter) + 2;
	};

	static compareId = <K extends ServiceKeyType>(id1: K, id2: K): boolean => {
		if (typeof id1 === 'number' || typeof id2 === 'string') {
			return id1 == id2;
		}
		// if the id is not a string or number, the Child Class must check it
		return false;
	};
}

export abstract class ExternalTitle extends BaseTitle {
	static readonly serviceName: ActivableName;
	static readonly serviceKey: ActivableKey;
	static readonly requireIdQuery: boolean = false;

	constructor(title?: Partial<ExternalTitle>) {
		super();
		if (title !== undefined) Object.assign(this, title);
	}

	/**
	 * Get the ID used by Mochi that can only be a number or a string.
	 */
	abstract get mochi(): number | string;

	toLocalTitle(): Title | undefined {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
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
	}

	static fromLocalTitle(title: Title): ExternalTitle | undefined {
		const Service = <typeof ExternalTitle>this.constructor;
		const key = Service.serviceKey;
		if (title.services[key] === undefined) return undefined;
		/// @ts-ignore
		return new Service(title.services[key]!, {
			progress: title.progress,
			status: title.status,
			score: title.score ? title.score : undefined,
			start: title.start ? new Date(title.start) : undefined,
			end: title.end ? new Date(title.end) : undefined,
			name: title.name,
		});
	}

	static idFromLink = (str: string): ServiceKeyType => {
		throw 'ExternalTitle.idFromLink is an abstract function';
	};

	static idFromString = (str: string): ServiceKeyType => {
		throw 'ExternalTitle.idFromString is an abstract function';
	};
}

export class Title extends BaseTitle implements LocalTitleProperties {
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
	 * Highest available chapter on MangaDex
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
	static async get(id: ServiceKeyType): Promise<Title> {
		if (typeof id !== 'number' && typeof id !== 'string') throw 'LocalTitle.id need to be a number or a string.';
		const title: StorageTitle | undefined = await LocalStorage.get<StorageTitle>(id);
		const rid = typeof id === 'number' ? id : parseInt(id);
		if (title === undefined) {
			return new Title(rid);
		}
		return new Title(rid, Title.fromSave(title));
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
		this.inList = true;
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
	localMerge = (other: Title): void => {
		// Update all 'number' properties to select the highest ones -- except for dates
		for (let k in this) {
			const key = k as keyof Title;
			if (this[key] && other[key] && typeof this[key] === 'number' && typeof other[key] === 'number') {
				Object.assign(this, { [key]: Math.max(this[key] as number, other[key] as number) });
			}
		}
		this.merge(other);
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

	addChapter = (chapter: number): boolean => {
		let index = this.chapters.indexOf(chapter);
		if (index >= 0) return false;
		// Sorted insert
		const max = this.chapters.length;
		index = 0;
		for (; index <= max; index++) {
			if (index == max) {
				this.chapters.push(chapter);
			} else if (chapter < this.chapters[index]) {
				this.chapters.splice(index, 0, chapter);
				break;
			}
		}
		// We only save 100 chapters
		if (max == 99) {
			if (index >= 50) this.chapters.unshift();
			else this.chapters.pop();
		}
		return true;
	};

	removeChapter = (chapter: number): void => {
		let index = this.chapters.indexOf(chapter);
		if (index >= 0) this.chapters.splice(index, 1);
	};

	refresh = async (): Promise<boolean> => {
		const reloaded = await LocalStorage.get<StorageTitle>(this.id);
		if (reloaded) {
			Object.assign(this, Title.fromSave(reloaded));
			return true;
		}
		return false;
	};
}

export class TitleCollection {
	collection: Title[] = [];

	constructor(titles: Title[] = []) {
		this.collection = titles;
	}

	/**
	 * Add Title(s) to the Collection.
	 */
	add = (...title: Title[]): void => {
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
					collection.add(new Title(parseInt(key), Title.fromSave(localTitles[key])));
				}
			}
		} else {
			const localTitles = await LocalStorage.getAll<StorageTitle>(list);
			if (localTitles !== undefined) {
				for (const id of list) {
					const titleId = typeof id === 'number' ? id : parseInt(id);
					if (localTitles[titleId] === undefined) {
						collection.add(new Title(titleId));
					} else {
						collection.add(new Title(titleId, Title.fromSave(localTitles[titleId])));
					}
				}
			}
		}
		return collection;
	}

	/**
	 * Find the title with the MangaDex ID `id` inside the Collection.
	 */
	find = (id: number): Title | undefined => {
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
				found.localMerge(title);
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

export type ExternalTitleList = Partial<{ [key in ActivableKey]: Promise<BaseTitle | RequestStatus> }>;

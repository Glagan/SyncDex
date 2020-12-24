import { LocalStorage } from './Storage';
import { Options } from './Options';
import { dateCompare } from './Utility';
import { ActivableKey, Service, ServiceList } from './Service';
import { History } from '../SyncDex/History';

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
	o?: 1;
}

export type SaveMediaKey = { s?: string; i?: number } | number;
export type SaveServiceList = {
	[key in ActivableKey]?: SaveMediaKey;
};

export interface StorageTitle {
	s: SaveServiceList; // services
	st: Status; // status
	sc?: number; // score
	p: SaveProgress; // progress
	m?: Partial<SaveProgress>; // max progress
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

export class StorageTitle {
	static valid(title: StorageTitle): boolean {
		return (
			typeof title.s === 'object' &&
			typeof title.st === 'number' &&
			typeof title.p === 'object' &&
			title.p.c !== undefined &&
			(title.sc === undefined || typeof title.sc === 'number') &&
			(title.m === undefined || typeof title.m === 'object') &&
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

// Fields that can be missing on a Service
export type MissableField = 'volume' | 'score' | 'start' | 'end';

export interface FoundTitle {
	key: MediaKey;
	name?: string;
	mangaDex?: number;
	status?: Status;
	progress?: Progress;
	max?: Partial<Progress>;
	score?: number;
	start?: Date;
	end?: Date;
	mochi: number | string;
}

export abstract class Title {
	key: MediaKey = { id: 0 };
	inList: boolean = false;
	synced: boolean = false;
	status: Status = Status.NONE;
	progress: Progress = { chapter: 0 };
	max?: Partial<Progress>;
	score: number = 0;
	start?: Date;
	end?: Date;
	name?: string;
	loggedIn: boolean = false;
	mangaDex?: number;

	static readonly missingFields: MissableField[] = [];

	constructor(title?: Partial<Title>) {
		if (title != undefined) Object.assign(this, title);
	}

	/**
	 * Pull the current status of the Media identified by ID.
	 * Return a `RequestStatus` on error.
	 */
	static get = async (id: MediaKey): Promise<Title | RequestStatus> => {
		throw 'Title.get is an abstract function';
		return RequestStatus.FAIL;
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
	 * Check if *this* Title is more recent that the other Title.
	 * A different score always trigger a true, since higher Services are tested last.
	 */
	isMoreRecent = (other: Title): boolean => {
		const missingFields = (<typeof Title>this.constructor).missingFields;
		return (
			this.progress.chapter > other.progress.chapter ||
			(missingFields.indexOf('volume') < 0 &&
				((this.progress.volume !== undefined && other.progress.volume === undefined) ||
					(this.progress.volume && other.progress.volume && this.progress.volume > other.progress.volume))) ||
			(missingFields.indexOf('score') < 0 && this.score > 0 && other.score > 0 && this.score != other.score) ||
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
	isSynced = (title: Title): boolean => {
		const missingFields = (<typeof Title>this.constructor).missingFields;
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
	import = (title: Title): void => {
		const missingFields = (<typeof Title>this.constructor).missingFields;
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
	merge = (title: Title): void => {
		const missingFields = (<typeof Title>title.constructor).missingFields;
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
		if (missingFields.indexOf('score') < 0 && title.score > 0) {
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

	static link = (id: MediaKey): string => {
		throw 'Title.link is an abstract function';
		return '#';
	};

	getLink = (): string => {
		return (<typeof Title>this.constructor).link(this.key);
	};

	isNextChapter = (progress: Progress): boolean => {
		return progress.chapter > this.progress.chapter && progress.chapter < Math.floor(this.progress.chapter) + 2;
	};
}

export class LocalTitle extends Title {
	/**
	 * External MangaDex List Status
	 */
	mdStatus: Status = Status.NONE;
	/**
	 * External MangaDex List Score
	 */
	mdScore: number = 0;
	/**
	 * `ServiceKey` list of mapped Service for the Title.
	 */
	services!: ServiceList;
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

	constructor(id: number, title?: Partial<LocalTitle>) {
		super(title);
		this.key = { id: id };
		this.inList = title !== undefined;
		this.synced = true;
		this.loggedIn = true;
		if (!title?.services || !this.services) this.services = {};
	}

	/**
	 * Convert a SaveTitle to a full length Title
	 */
	static fromSave(title: StorageTitle): Partial<LocalTitle> {
		const mapped: Partial<LocalTitle> = {
			inList: true,
			synced: true,
			services: {},
			progress: {
				chapter: title.p.c,
				volume: title.p.v,
				oneshot: title.p.o === 1,
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
		for (const key in title.s) {
			const id = title.s[key as ActivableKey];
			if (typeof id === 'number') {
				mapped.services![key as ActivableKey] = { id: id };
			} else {
				mapped.services![key as ActivableKey] = {
					id: id?.i ?? undefined,
					slug: id?.s ?? undefined,
				} as MediaKey;
			}
		}
		if (title.m) {
			mapped.max = {
				chapter: title.m.c,
				volume: title.m.v,
			};
		}
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
	static async get(id: number | string | object): Promise<LocalTitle> {
		if (typeof id !== 'number' && typeof id !== 'string') throw 'LocalTitle.id need to be a number or a string.';
		const title = await LocalStorage.get(id);
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
			s: {},
			st: this.status,
			sc: this.score > 0 ? this.score : undefined,
			p: {
				c: this.progress.chapter,
				v: this.progress.volume && this.progress.volume > 0 ? this.progress.volume : undefined,
				o: this.progress.oneshot ? 1 : undefined,
			},
			lt: this.lastTitle,
			id: this.lastChapter,
			hi: this.highest,
			n: this.name,
			lr: this.lastRead,
		};
		for (const key in this.services) {
			const id = this.services[key as ActivableKey]!;
			if (id.id !== undefined && id.slug === undefined) {
				mapped.s[key as ActivableKey] = id.id;
			} else {
				mapped.s[key as ActivableKey] = { i: id.id, s: id.slug };
			}
		}
		if (this.start) mapped.sd = this.start.getTime();
		if (this.end) mapped.ed = this.end.getTime();
		if (this.chapters.length > 0) {
			mapped.c = this.chapters;
		}
		if (this.max && ((this.max.chapter && this.max.chapter > 0) || (this.max.volume && this.max.volume > 0))) {
			mapped.m = {
				c: this.max.chapter,
				v: this.max.volume,
			};
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
		await LocalStorage.set(this.key.id!, this.toSave());
		return RequestStatus.SUCCESS;
	};

	/**
	 * Reset fields related to progress and save the Title.
	 */
	delete = async (): Promise<RequestStatus> => {
		this.inList = false;
		this.synced = false;
		this.status = Status.NONE;
		this.progress = { chapter: 0 };
		this.score = 0;
		this.start = undefined;
		this.end = undefined;
		this.name = undefined;
		this.chapters = [];
		await LocalStorage.remove(this.key.id!);
		return RequestStatus.SUCCESS;
	};

	/**
	 * Select highest values of both Titles and assign them to the receiving Title.
	 */
	localMerge = (other: LocalTitle): void => {
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
		let max = this.chapters.length;
		let hasChapter = this.chapters.indexOf(chapter) < 0;
		let index = 0;
		// Add to chapter list only if it's not already in
		if (hasChapter) {
			// Sorted insert
			for (; index <= max; index++) {
				if (index == max) {
					this.chapters.push(chapter);
				} else if (chapter < this.chapters[index]) {
					this.chapters.splice(index, 0, chapter);
					break;
				}
			}
		}
		// Prune chapters
		const half = Options.chaptersSaved / 2;
		while (max >= Options.chaptersSaved) {
			if (index <= half) this.chapters.unshift();
			else this.chapters.pop();
			max--;
		}
		return hasChapter;
	};

	removeChapter = (chapter: number): void => {
		let index = this.chapters.indexOf(chapter);
		if (index >= 0) this.chapters.splice(index, 1);
	};

	/**
	 * Remove all chapters above the current progress and
	 * 	fill possible gap in chapters between the current progress and a new chapter.
	 */
	updateChapterList = (chapter: number): void => {
		// Prune chapters
		this.chapters = this.chapters.filter((c) => c <= chapter);
		this.addChapter(chapter);
		// Add between gaps
		const limit = Math.max(0, chapter - Options.chaptersSaved - 1);
		for (let i = chapter; i > limit; i--) {
			this.addChapter(i);
		}
	};

	refresh = async (): Promise<boolean> => {
		const reloaded = await LocalStorage.get(this.key.id!);
		if (reloaded) {
			Object.assign(this, LocalTitle.fromSave(reloaded));
			return true;
		}
		return false;
	};

	setProgress = (progress: Progress): boolean => {
		let completed = false;
		const created = this.status == Status.NONE || this.status == Status.PLAN_TO_READ;
		if (progress.oneshot || (this.max?.chapter && this.max.chapter <= progress.chapter)) {
			completed = this.status !== Status.COMPLETED || !this.end;
			this.status = Status.COMPLETED;
			if (!this.end) this.end = new Date();
		} else this.status = Status.READING;
		this.progress.chapter = progress.chapter;
		if (progress.volume && (!this.progress.volume || this.progress.volume < this.progress.volume)) {
			this.progress.volume = progress.volume;
		}
		this.progress.oneshot = progress.oneshot;
		if (created && !this.start) {
			this.start = new Date();
		}
		if (Options.saveOpenedChapters) {
			this.addChapter(progress.chapter);
		}
		return completed;
	};

	setHistory = async (chapterId: number, progress?: Progress): Promise<void> => {
		this.lastChapter = chapterId;
		this.lastRead = Date.now();
		this.history = progress ? progress : this.progress;
		History.add(this.key.id!);
		await History.save();
	};

	static link = (key: MediaKey): string => {
		return `https://mangadex.org/title/${key.id}`;
	};
}

export abstract class ExternalTitle extends Title {
	static readonly service: typeof Service;
	static readonly updateKeyOnFirstFetch: boolean = false;

	static idFromLink = (href: string): MediaKey => {
		throw 'ExternalTitle.idFromLink is an abstract function';
		return { id: 0 };
	};
	static idFromString = (str: string): MediaKey => {
		throw 'ExternalTitle.idFromString is an abstract function';
		return { id: 0 };
	};

	/**
	 * Get the ID used by Mochi that can only be a number or a string.
	 */
	abstract get mochi(): number | string;
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
		const index = this.collection.findIndex((t) => t.key.id == id);
		if (index !== undefined) {
			this.collection.splice(index, 1);
		}
	};

	/**
	 * List of all MangaDex IDs in the Collection.
	 */
	get ids(): number[] {
		return this.collection.map((title) => {
			return title.key.id!;
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
			const localTitles = await LocalStorage.getAll();
			for (const key in localTitles) {
				if (!LocalStorage.isSpecialKey(key)) {
					collection.add(new LocalTitle(parseInt(key), LocalTitle.fromSave(localTitles[key])));
				}
			}
		} else {
			if (list.length == 0) return collection;
			const localTitles = await LocalStorage.getTitleList(list);
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
			if (title.key.id === id) return title;
		}
		return undefined;
	};

	sort = (compareFn?: ((a: LocalTitle, b: LocalTitle) => number) | undefined): LocalTitle[] => {
		return this.collection.sort(compareFn);
	};

	slice = (start?: number | undefined, end?: number | undefined): LocalTitle[] => {
		return this.collection.slice(start, end);
	};

	/**
	 * Apply merge to each Titles in the receiving Collection with the other Collection.
	 * Add missing Titles to the receiving Collection.
	 */
	merge = (other: TitleCollection): void => {
		for (const title of other.collection) {
			let found = this.find(title.key.id!);
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
	persist = async (): Promise<void> => {
		const mapped: { [key: number]: StorageTitle } = {};
		for (const title of this.collection) {
			mapped[title.key.id!] = title.toSave();
		}
		return LocalStorage.raw('set', mapped);
	};
}

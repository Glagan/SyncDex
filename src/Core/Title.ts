import { dateCompare } from './Utility';
import { ActivableKey } from '../Service/Keys';
import { Options } from './Options';
import { History } from './History';
import { Storage } from './Storage';

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

// Fields that can be missing on a Service
export type MissableField = 'volume' | 'score' | 'start' | 'end';

// TODO: Remove
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
	mochiKey: number | string;
}

export abstract class Title {
	key: MediaKey = { id: 0 };
	inList: boolean = false;
	loggedIn: boolean = false;
	name?: string;
	max?: Partial<Progress>;
	// Synced keys
	status: Status = Status.NONE;
	progress: Progress = { chapter: 0 };
	score: number = 0;
	start?: Date;
	end?: Date;

	static readonly missingFields: MissableField[] = [];

	constructor(title?: Partial<Title>) {
		if (title != undefined) Object.assign(this, title);
	}

	get missingFields() {
		return (<typeof Title>this.constructor).missingFields;
	}

	set chapter(chapter: number) {
		this.progress.chapter = chapter;
	}

	get chapter() {
		return this.progress.chapter;
	}

	set volume(volume: number | undefined) {
		this.progress.volume = volume;
	}

	get volume() {
		return this.progress.volume;
	}

	get isOneshot() {
		return this.progress.oneshot ? true : false;
	}

	set isOneshot(value: boolean | undefined) {
		this.progress.oneshot = value;
	}

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
		const missingFields = this.missingFields;
		return (
			this.chapter > other.chapter ||
			(missingFields.indexOf('volume') < 0 &&
				((this.volume !== undefined && other.volume === undefined) ||
					(this.volume && other.volume && this.volume > other.volume))) ||
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
	isSyncedWith = (title: Title): boolean => {
		const missingFields = this.missingFields;
		const synced =
			title.status === this.status &&
			Math.floor(title.chapter) === Math.floor(this.chapter) &&
			(missingFields.indexOf('volume') >= 0 ||
				title.missingFields.indexOf('volume') >= 0 ||
				title.volume === this.volume) &&
			(missingFields.indexOf('score') >= 0 ||
				title.missingFields.indexOf('score') >= 0 ||
				title.score === this.score) &&
			(missingFields.indexOf('start') >= 0 ||
				title.missingFields.indexOf('start') >= 0 ||
				(title.start === undefined && this.start === undefined) ||
				(title.start !== undefined && this.start !== undefined && dateCompare(title.start, this.start))) &&
			(missingFields.indexOf('end') >= 0 ||
				title.missingFields.indexOf('end') >= 0 ||
				(title.end === undefined && this.end === undefined) ||
				(title.end !== undefined && this.end !== undefined && dateCompare(title.end, this.end)));
		return synced;
	};

	setProgress(progress: Progress): boolean {
		let completed = false;
		const created = this.status == Status.NONE || this.status == Status.PLAN_TO_READ;
		if (progress.oneshot || (this.max?.chapter && this.max.chapter <= progress.chapter)) {
			completed = this.status !== Status.COMPLETED || !this.end;
			this.status = Status.COMPLETED;
			if (!this.end) this.end = new Date();
		} else if (this.status == Status.NONE) {
			this.status = Status.READING;
		}
		this.progress.chapter = progress.chapter;
		if (progress.volume && (!this.volume || this.volume < progress.volume)) {
			this.volume = progress.volume;
		}
		this.progress.oneshot = progress.oneshot;
		if (created && !this.start) {
			this.start = new Date();
		}
		return completed;
	}

	/**
	 * Assign all values from the Title to *this*.
	 * If a field is missing in *this* it's ignored and deleted.
	 */
	import = (title: Title): void => {
		const missingFields = this.missingFields;
		this.status = title.status;
		this.chapter = title.chapter;
		if (missingFields.indexOf('volume') < 0 && title.volume) {
			this.volume = title.volume;
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
	 * Score is always exported to the Title if it exists.
	 */
	merge(title: Title): void {
		const missingFields = title.missingFields;
		if (title.status !== Status.NONE) {
			this.status = title.status;
		}
		if (title.chapter > this.chapter) {
			this.chapter = title.chapter;
		}
		if (missingFields.indexOf('volume') < 0 && title.volume && (!this.volume || title.volume > this.volume)) {
			this.volume = title.volume;
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
	}

	/**
	 * Call merge on the given Title.
	 */
	mergeTo = (title: Title): void => {
		title.merge(this);
	};

	isNextChapter = (progress: Progress): boolean => {
		return progress.chapter > this.chapter && progress.chapter < Math.floor(this.chapter) + 2;
	};

	/**
	 * Get the ID used by Mochi that can only be a number or a string.
	 */
	get uniqueKey(): number | string {
		return this.key.id!;
	}
}

export class LocalTitle extends Title {
	// `ServiceKey` list of mapped Service for the Title.
	services!: ServiceList;
	forceServices!: ActivableKey[];
	// List of all read Chapters.
	chapters!: number[];
	// Last time the Title page of the Title was visited.
	lastTitle?: number;
	// MangaDex Chapter ID of the last read chapter.
	lastChapter?: number;
	// Displayed Chapter/Volume in the History page.
	history?: Progress;
	// Highest available chapter on MangaDex
	highest?: number;
	// Last time a Chapter was read for the Title
	lastRead?: number;
	// Number of chapters per volume
	volumeChapterCount!: { [key: number]: number };
	volumeChapterOffset!: { [key: number]: number };
	volumeResetChapter: boolean;

	constructor(id: number, title?: Partial<LocalTitle>) {
		super(title);
		this.key = { id: id };
		this.inList = title !== undefined;
		this.loggedIn = true;
		if (!this.forceServices) this.forceServices = [];
		if (!this.chapters) this.chapters = [];
		if (!title?.services || !this.services) this.services = {};
		if (!title?.volumeChapterCount) this.volumeChapterCount = {};
		if (!title?.volumeChapterOffset) this.volumeChapterOffset = {};
		this.volumeResetChapter = !!title?.volumeChapterCount;
	}

	static valid(title: StorageTitle): boolean {
		return (
			typeof title.s === 'object' &&
			(title.fs === undefined || Array.isArray(title.fs)) &&
			typeof title.st === 'number' &&
			typeof title.p === 'object' &&
			title.p.c !== undefined &&
			(title.sc === undefined || typeof title.sc === 'number') &&
			(title.m === undefined || typeof title.m === 'object') &&
			(title.v === undefined || typeof title.v === 'object') &&
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

	/**
	 * Convert a SaveTitle to a full length Title
	 */
	static fromSave(title: StorageTitle): Partial<LocalTitle> {
		const mapped: Partial<LocalTitle> = {
			inList: true,
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
		if (title.fs) mapped.forceServices = title.fs;
		if (title.m) {
			mapped.max = {
				chapter: title.m.c,
				volume: title.m.v,
			};
		}
		if (title.v) {
			mapped.volumeChapterCount = {};
			mapped.volumeChapterOffset = {};
			for (const volumeKey in title.v) {
				if (Object.prototype.hasOwnProperty.call(title.v, volumeKey)) {
					const count = title.v[volumeKey];
					if (typeof count === 'object') {
						mapped.volumeChapterOffset[volumeKey] = count[0];
						mapped.volumeChapterCount[volumeKey] = count[1];
					} else mapped.volumeChapterCount[volumeKey] = count;
				}
			}
		}
		if (title.h) {
			mapped.history = {
				chapter: title.h.c,
				volume: title.h.v,
			};
		}
		return mapped;
	}

	static get = async (id: number): Promise<LocalTitle> => {
		const data = await Storage.get(id);
		if (data === undefined) return new LocalTitle(id);
		return new LocalTitle(id, LocalTitle.fromSave(data));
	};

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
				c: this.chapter,
				v: this.volume && this.volume > 0 ? this.volume : undefined,
				o: this.isOneshot ? 1 : undefined,
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
		if (this.forceServices) mapped.fs = this.forceServices;
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
		if (this.volumeChapterCount && Object.keys(this.volumeChapterCount).length > 0) {
			mapped.v = {};
			for (const volumeKey in this.volumeChapterCount) {
				if (Object.prototype.hasOwnProperty.call(this.volumeChapterCount, volumeKey)) {
					const count = this.volumeChapterCount[volumeKey];
					if (this.volumeChapterOffset[volumeKey] !== undefined) {
						mapped.v[volumeKey] = [this.volumeChapterOffset[volumeKey], count];
					} else mapped.v[volumeKey] = count;
				}
			}
		}
		if (this.history) {
			mapped.h = {
				c: this.history.chapter,
				v: this.history.volume,
			};
		}
		return mapped;
	};

	persist = async (): Promise<RequestStatus> => {
		this.inList = true;
		await Storage.set({ [`${this.key.id}`]: this.toSave() });
		return RequestStatus.SUCCESS;
	};

	refresh = async (): Promise<RequestStatus> => {
		const data = await LocalTitle.get(this.key.id!);
		Object.assign(this, data);
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		this.inList = false;
		this.status = Status.NONE;
		this.progress = { chapter: 0 };
		this.score = 0;
		this.start = undefined;
		this.end = undefined;
		this.name = undefined;
		this.chapters = [];
		await Storage.remove(`${this.key.id}`);
		return RequestStatus.SUCCESS;
	};

	merge(other: Title): void {
		if (other instanceof LocalTitle) {
			// Update all 'number' properties to select the highest ones
			for (let k in this) {
				const key = k as keyof Title;
				if (this[key] && other[key] && typeof this[key] === 'number' && typeof other[key] === 'number') {
					Object.assign(this, { [key]: Math.max(this[key] as number, other[key] as number) });
				}
			}
			super.merge(other);
			Object.assign(this.services, other.services); // Merge Services -- other erase *this*
			// Merge chapters array
			this.chapters = this.chapters.concat(other.chapters);
			// Sort and only keep the first (desc) *Options.chaptersSaved* chapters
			this.chapters.sort((a, b) => b - a);
			if (this.chapters.length > Options.chaptersSaved) {
				const diff = Options.chaptersSaved - this.chapters.length;
				this.chapters.splice(-diff, diff);
			}
			// Add missing History fields
			if (!this.history) this.history = other.history;
			if (!this.lastRead) this.lastRead = other.lastRead;
			if (!this.lastChapter) this.lastChapter = other.lastChapter;
			if (!this.lastTitle) this.lastTitle = other.lastTitle;
			if (!this.highest) this.highest = other.highest;
		} else {
			super.merge(other);
		}
	}

	setProgress(progress: Progress): boolean {
		const res = super.setProgress(progress);
		if (Options.saveOpenedChapters) {
			this.addChapter(progress.chapter);
		}
		return res;
	}

	addChapter = (chapter: number): boolean => {
		let max = this.chapters.length;
		const doAdd = this.chapters.indexOf(chapter) < 0;
		let index = 0;
		// Add to chapter list only if it's not already in
		if (doAdd) {
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
		return doAdd;
	};

	removeChapter = (chapter: number): void => {
		const index = this.chapters.indexOf(chapter);
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

	setHistory = async (chapterId: number, progress?: Progress): Promise<void> => {
		this.lastChapter = chapterId;
		this.lastRead = Date.now();
		this.history = progress ? progress : this.progress;
		if (History.add(this.key.id!)) {
			await History.save();
		}
	};

	doForceService = (key: ActivableKey): boolean => {
		return this.forceServices.indexOf(key) >= 0;
	};

	addForceService = (key: ActivableKey): boolean => {
		if (this.forceServices.indexOf(key) < 0) {
			this.forceServices.push(key);
			return true;
		}
		return false;
	};

	removeForceService = (key: ActivableKey): boolean => {
		const index = this.forceServices.indexOf(key);
		if (index >= 0) {
			this.forceServices.splice(index, 1);
			return true;
		}
		return false;
	};

	updateProgressFromVolumes = (progress: Progress): void => {
		if (this.volumeResetChapter && progress.volume) {
			if (progress.volume > 1 && progress.chapter == 0) {
				progress.chapter = 0.1;
			}
			for (const volumeKey in this.volumeChapterCount) {
				const volume = parseInt(volumeKey);
				if (volume < progress.volume) {
					progress.chapter += this.volumeChapterCount[volumeKey];
				}
			}
			if (this.volumeChapterOffset[progress.volume] !== undefined) {
				progress.chapter -= this.volumeChapterOffset[progress.volume];
			}
		}
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
		const index = this.collection.findIndex((t) => t.key.id == id);
		if (index !== undefined) {
			this.collection.splice(index, 1);
		}
	};

	/**
	 * List of all MangaDex IDs in the Collection.
	 */
	get ids(): (number | string)[] {
		return this.collection.map((title) => {
			return title.uniqueKey;
		});
	}

	/**
	 * The length of the Collection.
	 */
	get length(): number {
		return this.collection.length;
	}

	/**
	 * Find the title with the MangaDex ID `id` inside the Collection.
	 */
	find = (id: number): LocalTitle | undefined => {
		for (const title of this) {
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
		for (const title of other) {
			let found = this.find(title.key.id!);
			if (found !== undefined) {
				found.merge(title);
			} else {
				this.add(title);
			}
		}
	};

	/**
	 * @see merge
	 * Call merge function on other instead of *this*.
	 */
	mergeInto = (other: TitleCollection): void => {
		other.merge(this);
	};

	static get = async (list?: (string | number)[]): Promise<TitleCollection> => {
		let collection = new TitleCollection();
		if (list === undefined) {
			const localSave = await Storage.get();
			for (const key in localSave) {
				if (!Storage.isSpecialKey(key)) {
					collection.add(new LocalTitle(parseInt(key), LocalTitle.fromSave(localSave[key])));
				}
			}
		} else {
			if (list.length == 0) return collection;
			const keys = [];
			for (const key of list) {
				if (typeof key === 'number') {
					keys.push(`${key}`);
				} else keys.push(key);
			}
			const localTitles = await Storage.get(keys);
			if (localTitles) {
				for (const id of list) {
					const titleId = typeof id === 'number' ? id : parseInt(id);
					if (localTitles[titleId] === undefined) {
						collection.add(new LocalTitle(titleId));
					} else {
						collection.add(new LocalTitle(titleId, LocalTitle.fromSave(localTitles[titleId]!)));
					}
				}
			}
		}
		return collection;
	};

	persist = async (): Promise<void> => {
		const mapped: { [key: string]: StorageTitle } = {};
		for (const title of this) {
			mapped[title.uniqueKey] = title.toSave();
		}
		return Storage.set(mapped);
	};

	[Symbol.iterator]() {
		let i = 0;
		const collection = this.collection;

		return {
			next(): IteratorResult<LocalTitle> {
				if (i < collection.length) {
					return {
						done: false,
						value: collection[i++],
					};
				} else {
					return {
						done: true,
						value: null,
					};
				}
			},
		};
	}
}

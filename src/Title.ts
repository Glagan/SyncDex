import { Progress, ExportedSave } from './interfaces';
import { ServiceKey, Status } from './Service/Service';
import { LocalStorage } from './Storage';
import { Options } from './Options';

interface SaveProgress {
	c: number;
	v?: number;
}

interface InitialState {
	start: number;
	end?: number;
	status: Status;
}

export interface SaveTitle {
	s: { [key in ServiceKey]?: number | string }; // services
	st: Status; // status
	p: SaveProgress; // progress
	c?: number[]; // chapters
	i?: {
		s: number; // start
		e?: number; // end
		st: number; // status
	};
	lt?: number; // lastTitle
	lc?: number; // lastCheck
	// History
	id?: number; // lastChapter
	h?: SaveProgress; // history
	hi?: number; // highest
	n?: string; // name
	lr?: number; // lastRead
}

export interface FullTitle {
	services: { [key in ServiceKey]?: number | string };
	status: Status;
	progress: Progress;
	chapters: number[];
	initial?: InitialState;
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	history?: Progress;
	highest?: number;
	name?: string;
	lastRead?: number;
}
type NumberKey = Pick<FullTitle, 'lastTitle' | 'lastCheck' | 'lastChapter' | 'highest' | 'lastRead'>;

/**
 * Handle conversion between a SaveTitle in LocalStorage and a FullTitle.
 * Storing only short keys for each Title save about 80% space (from 86 to 17 bytes for keys)
 * Also using SaveProgress reduce Progress space from 12 to 2 bytes for keys.
 */
export class Title implements FullTitle {
	new: boolean;
	id: number;
	services: { [key in ServiceKey]?: number | string } = {};
	status: Status = 0;
	progress: Progress = { chapter: -1, volume: 0 };
	chapters: number[] = [];
	initial?: {
		start: number;
		end: number;
		status: Status;
	};
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	history?: Progress;
	highest?: number;
	name?: string;
	lastRead?: number;
	static numberKeys: (keyof NumberKey)[] = ['lastRead', 'lastTitle', 'lastCheck', 'lastChapter'];

	constructor(id: number, title?: Partial<FullTitle>) {
		this.new = title == undefined;
		this.id = id;
		if (!this.new) {
			Object.assign(this, title);
		}
	}

	static toTitle(title: SaveTitle): FullTitle {
		const mapped: FullTitle = {
			services: title.s,
			progress: {
				chapter: title.p.c,
				volume: title.p.v,
			},
			status: title.st,
			chapters: title.c || [],
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
		if (title.i) {
			mapped.initial = {
				start: title.i.s,
				end: title.i.e,
				status: title.i.st,
			};
		}
		return mapped;
	}

	/**
	 * Retrieve a Title in a SaveTitle format and return an instance of Title
	 * @param id number The MangaDex id of the Title
	 */
	static async get(id: number | string): Promise<Title> {
		const title = await LocalStorage.get<SaveTitle>(id);
		const rid = typeof id === 'number' ? id : parseInt(id);
		if (title === undefined) {
			return new Title(rid);
		}
		return new Title(rid, Title.toTitle(title));
	}

	/**
	 * Select highest values of both Titles and assign them to *this*
	 */
	merge = (other: Title): void => {
		// Update *this* Status if it's NONE or/and if other is not NONE
		if (other.status != Status.NONE || this.status == Status.NONE) {
			this.status = other.status;
		}
		if (this.progress.chapter < other.progress.chapter) {
			this.progress = other.progress;
		}
		if (this.initial === undefined) {
			this.initial = other.initial;
		}
		Object.assign(this.services, other.services); // Merge Services - other erase *this*
		// Update all 'number' properties (last...) to select the highest ones
		for (const key of Title.numberKeys) {
			if (this[key] && other[key]) {
				this[key] = Math.max(this[key] as number, other[key] as number);
			}
		}
		// Merge chapters array
		this.chapters = this.chapters.concat(other.chapters);
		// Sort and only keep the first (desc) *Options.chaptersSaved* chapters
		this.chapters.sort((a, b) => b - a);
		if (this.chapters.length > Options.chaptersSaved) {
			const diff = Options.chaptersSaved - this.chapters.length;
			this.chapters.splice(-diff, diff);
		}
	};

	toSave = (): SaveTitle => {
		const mapped: SaveTitle = {
			s: this.services,
			st: this.status,
			p: {
				c: this.progress.chapter,
				v: this.progress.volume,
			},
			lt: this.lastTitle,
			lc: this.lastCheck,
			id: this.lastChapter,
			hi: this.highest,
			n: this.name,
			lr: this.lastRead,
		};
		if (this.chapters.length > 0) {
			mapped.c = this.chapters;
		}
		if (this.history) {
			mapped.h = {
				c: this.history.chapter,
				v: this.history.volume,
			};
		}
		if (this.initial) {
			mapped.i = {
				s: this.initial.start,
				e: this.initial.end,
				st: this.initial.status,
			};
		}
		return mapped;
	};

	/**
	 * Convert a Title to a SaveTitle to follow the save schema and save it in LocalStorage
	 */
	save = async (): Promise<void> => {
		return LocalStorage.set(this.id, this.toSave());
	};
}

export class TitleCollection {
	private counter = 0;
	collection: Title[] = [];

	constructor(titles: Title[] = []) {
		this.collection = titles;
	}

	add = (title: Title): void => {
		this.collection.push(title);
	};

	get ids(): number[] {
		return this.collection.map((title) => {
			return title.id;
		});
	}

	get length(): number {
		return this.collection.length;
	}

	static async get(list?: number[] | string[]): Promise<TitleCollection> {
		let collection = new TitleCollection();
		if (list === undefined) {
			const localTitles = (await LocalStorage.getAll()) as ExportedSave;
			for (const key in localTitles) {
				if (key !== 'options' && key != 'history') {
					collection.add(new Title(parseInt(key), Title.toTitle(localTitles[key])));
				}
			}
		} else {
			const localTitles = await LocalStorage.getAll<SaveTitle>(list);
			if (localTitles !== undefined) {
				for (const id of list) {
					const titleId = typeof id === 'number' ? id : parseInt(id);
					if (localTitles[titleId] === undefined) {
						collection.add(new Title(titleId));
					} else {
						collection.add(new Title(titleId, Title.toTitle(localTitles[titleId])));
					}
				}
			}
		}
		return collection;
	}

	find = (id: number): Title | undefined => {
		for (const title of this.collection) {
			if (title.id === id) return title;
		}
		return undefined;
	};

	/**
	 * Apply merge to each Titles in *this* collection with the other Collection.
	 * Add missing Titles in *this*
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

	save = async (): Promise<void> => {
		const mapped: { [key: number]: SaveTitle } = {};
		for (const title of this.collection) {
			mapped[title.id] = title.toSave();
		}
		return LocalStorage.raw(mapped);
	};
}

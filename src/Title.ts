import { Progress, ExportedSave } from './interfaces';
import { ServiceKey, Status } from './Service/Service';
import { LocalStorage } from './Storage';
import { Options } from './Options';

interface SaveProgress {
	c: number;
	v?: number;
}

export interface SaveTitle {
	s: { [key in ServiceKey]?: number | string }; // services
	st: Status; // status
	sc: number; // score
	p: SaveProgress; // progress
	c?: number[]; // chapters
	sd?: number; // start
	ed?: number; // end
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
	score: number;
	progress: Progress;
	chapters: number[];
	start?: number;
	end?: number;
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	history?: Progress;
	highest?: number;
	name?: string;
	lastRead?: number;
}
type NumberKey = Pick<
	FullTitle,
	'score' | 'start' | 'end' | 'lastTitle' | 'lastCheck' | 'lastChapter' | 'highest' | 'lastRead'
>;

/**
 * Handle conversion between a SaveTitle in LocalStorage and a FullTitle.
 */
export class Title implements FullTitle {
	new: boolean;
	id: number;
	services: { [key in ServiceKey]?: number | string } = {};
	status: Status = Status.NONE;
	score: number = -1;
	progress: Progress = { chapter: -1, volume: 0 };
	chapters: number[] = [];
	start?: number;
	end?: number;
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	history?: Progress;
	highest?: number;
	name?: string;
	lastRead?: number;
	static numberKeys: (keyof NumberKey)[] = [
		'score',
		'start',
		'end',
		'lastTitle',
		'lastCheck',
		'lastChapter',
		'highest',
		'lastRead',
	];

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
			score: title.sc,
			chapters: title.c || [],
			start: title.sd,
			end: title.ed,
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
		Object.assign(this.services, other.services); // Merge Services -- other erase *this*
		// Update all 'number' properties to select the highest ones -- except for dates
		for (let k in this) {
			const key = k as keyof Title;
			if (this[key] && other[key] && typeof this[key] === 'number' && typeof other[key] === 'number') {
				const order = key == 'start' || key == 'end' ? Math.min : Math.max;
				Object.assign(this, { [key]: order(this[key] as number, other[key] as number) });
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
			sc: this.score,
			p: {
				c: this.progress.chapter,
				v: this.progress.volume,
			},
			sd: this.start,
			ed: this.end,
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

import { Progress, ExportedSave } from './interfaces';
import { ServiceKey, Status } from './Service/Service';
import { LocalStorage } from './Storage';

interface SaveTitle {
	s: { [key in ServiceKey]?: number | string };
	p: Progress;
	c: number[];
	i?: {
		s: number;
		e: number;
		st: Status;
	};
	lt?: number;
	lc?: number;
	// History
	id?: number;
	n?: string;
	lr?: number;
}

export interface FullTitle {
	services: { [key in ServiceKey]?: number | string };
	progress: Progress;
	chapters: number[];
	initial?: {
		start: number;
		end: number;
		status: Status;
	};
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	name?: string;
	lastRead?: number;
}

/**
 * Handle conversion between a SaveTitle in LocalStorage and a Title.
 * Storing only short keys for each Title save about 80% space (from 86 to 17 bytes)
 */
export class Title implements FullTitle {
	new: boolean;
	id: number;
	services: { [key in ServiceKey]?: number | string } = {};
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
	name?: string;
	lastRead?: number;

	constructor(id: number, title?: FullTitle) {
		this.new = title == undefined;
		this.id = id;
		if (!this.new) {
			Object.assign(this, title);
		}
	}

	static toTitle(title: SaveTitle): FullTitle {
		const mapped: FullTitle = {
			services: title.s,
			progress: title.p,
			chapters: title.c,
			lastTitle: title.lt,
			lastCheck: title.lc,
			lastChapter: title.id,
			name: title.n,
			lastRead: title.lr,
		};
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

	toSave = (): SaveTitle => {
		const mapped: SaveTitle = {
			s: this.services,
			p: this.progress,
			c: this.chapters,
			lt: this.lastTitle,
			lc: this.lastCheck,
			id: this.lastChapter,
			n: this.name,
			lr: this.lastRead,
		};
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
				for (let index = 0, len = list.length; index < len; index++) {
					const titleId: number =
						typeof list[index] === 'number'
							? (list[index] as number)
							: parseInt(list[index] as string);
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
		for (let index = 0, len = this.collection.length; index < len; index++) {
			const title = this.collection[index];
			if (title.id === id) return title;
		}
		return undefined;
	};

	save = async (): Promise<void> => {
		const mapped: { [key: number]: SaveTitle } = {};
		for (let index = 0, len = this.collection.length; index < len; index++) {
			const title = this.collection[index];
			mapped[title.id] = title.toSave();
		}
		return LocalStorage.raw(mapped);
	};
}

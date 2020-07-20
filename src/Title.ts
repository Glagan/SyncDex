import { LocalStorage } from './Storage';
import { Options, AvailableOptions } from './Options';
import { RequestStatus } from './Runtime';
import { DOM, AppendableElement } from './DOM';
import { dateFormat, dateCompare } from './Utility';

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

export interface SaveTitle {
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

export interface FullTitle {
	services: ServiceList;
	status: Status;
	score: number;
	progress: Progress;
	chapters: number[];
	start?: Date;
	end?: Date;
	lastTitle?: number;
	lastCheck?: number;
	// History
	lastChapter?: number;
	history?: Progress;
	highest?: number;
	name?: string;
	lastRead?: number;
}

export type ExportOptions = {
	options?: AvailableOptions;
};

export type ExportHistory = {
	history?: number[];
};

export type ExportedTitles = {
	[key: string]: SaveTitle;
};

export type ExportedSave = ExportOptions & ExportHistory & ExportedTitles;

export class SaveTitle {
	static valid(title: SaveTitle): boolean {
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

/**
 * Handle conversion between a SaveTitle in LocalStorage and a FullTitle.
 */
export class Title implements FullTitle {
	/**
	 * Was the Title present in Local Storage.
	 */
	new: boolean;
	/**
	 * MangaDex ID of the Title.
	 */
	id: number;
	/**
	 * `ServiceKey` list of mapped Service for the Title.
	 */
	services: ServiceList = {};
	/**
	 * Current Chapter/Volume that should be synced with External Services.
	 */
	progress: Progress = { chapter: 0, volume: 0 };
	/**
	 * Status of the Title.
	 */
	status: Status = Status.NONE;
	/**
	 * Score of the Title.
	 */
	score: number = 0;
	/**
	 * List of all read Chapters.
	 */
	chapters: number[] = [];
	/**
	 * Start Date of the Title.
	 */
	start?: Date;
	/**
	 * End Date of the Title.
	 */
	end?: Date;
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
	 * Name of the Title
	 */
	name?: string;
	/**
	 * Last time a Chapter was read for the Title
	 */
	lastRead?: number;

	constructor(id: number, title?: Partial<FullTitle>) {
		this.new = title == undefined;
		this.id = id;
		if (!this.new) {
			Object.assign(this, title);
		}
	}

	/**
	 * Convert a SaveTitle to a full length Title
	 */
	static toTitle(title: SaveTitle): FullTitle {
		const mapped: FullTitle = {
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
	static async get(id: number | string): Promise<Title> {
		const title = await LocalStorage.get<SaveTitle>(id);
		const rid = typeof id === 'number' ? id : parseInt(id);
		if (title === undefined) {
			return new Title(rid);
		}
		return new Title(rid, Title.toTitle(title));
	}

	/**
	 * Select highest values of both Titles and assign them to the receiving Title.
	 */
	merge = (other: Title): void => {
		// Update all 'number' properties to select the highest ones -- except for dates
		for (let k in this) {
			const key = k as keyof Title;
			if (this[key] && other[key] && typeof this[key] === 'number' && typeof other[key] === 'number') {
				Object.assign(this, { [key]: Math.max(this[key] as number, other[key] as number) });
			}
		}
		// Dates

		// Update *this* Status if it's NONE or/and if other is not NONE
		if (other.status != Status.NONE || this.status == Status.NONE) {
			this.status = other.status;
		}
		if (this.progress.chapter < other.progress.chapter) {
			this.progress = other.progress;
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
		// Name
		if (this.name === undefined) {
			this.name = other.name;
		}
	};

	/**
	 * Convert a Title to a `SaveTitle` with reduced key length.
	 * All keys with no value or empty value are not saved.
	 */
	toSave = (): SaveTitle => {
		const mapped: SaveTitle = {
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
	save = async (): Promise<void> => {
		this.new = false;
		return LocalStorage.set(this.id, this.toSave());
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
		const mapped: { [key: number]: SaveTitle } = {};
		for (const title of this.collection) {
			mapped[title.id] = title.toSave();
		}
		return LocalStorage.raw(mapped);
	};
}

export type MissableField = 'score' | 'start' | 'end';

export abstract class ServiceTitle {
	static readonly serviceName: ActivableName;
	static readonly serviceKey: ActivableKey;

	/**
	 * Is the Media existing on the Service.
	 */
	loggedIn: boolean = false;
	/**
	 * Is the Media synced with the local SyncDex Title.
	 */
	synced: boolean = false;
	/**
	 * The key of the Media on the Service.
	 */
	abstract id: ServiceKeyType;
	/**
	 * Is the Media existing on the Service.
	 */
	inList: boolean = false;
	/**
	 * The stauts of the Media on the Service.
	 */
	status: Status;
	/**
	 * The mapped MangaDex ID of the Media.
	 */
	mangaDex?: number;
	/**
	 * Progress on the Media.
	 */
	progress: Progress = {
		chapter: 0,
	};
	/**
	 * Media Score if supported by the Service.
	 * In a 0-100 range that (might) need to be converted inside final classes.
	 */
	score?: number = 0;
	/**
	 * Media Start Date if supported by the Service.
	 */
	start?: Date;
	/**
	 * Media End Date if supported by the Service.
	 */
	end?: Date;
	/**
	 * Name of the Media on the Service.
	 */
	name?: string;
	/**
	 * List of fields not supported by the Service.
	 */
	static readonly missingFields: MissableField[] = [];
	static readonly missingFieldsMap: { [key in MissableField]: string } = {
		start: 'Start Date',
		end: 'Finish Date',
		score: 'Score',
	};

	constructor(title?: Partial<ServiceTitle>) {
		this.status = Status.NONE;
		if (title !== undefined) {
			Object.assign(this, title);
		}
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
	 * Convert the Media to a Title if possible (MangaDex ID available), or undefined.
	 */
	toTitle(): Title | undefined {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { [(<typeof ServiceTitle>this.constructor).serviceKey]: this.id },
			progress: this.progress,
			status: this.status,
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			start: this.start ? this.start : undefined,
			end: this.end ? this.end : undefined,
			name: this.name,
		});
	}

	/**
	 * Get the ID used by Mochi that can only be a number or a string.
	 */
	abstract get mochi(): number | string;

	/**
	 * Link to a single Media page.
	 */
	static link = (id: ServiceKeyType): string => {
		return '#';
	};

	link(): string {
		return (<typeof ServiceTitle>this.constructor).link(this.id);
	}

	/**
	 * Pull the current status of the Media identified by ID.
	 * Return a `RequestStatus` on error.
	 */
	static get = async (id: ServiceKeyType): Promise<ServiceTitle | RequestStatus> => {
		return RequestStatus.FAIL;
	};

	/**
	 * Convert a Title for the Media if possible (Service ID available), or undefined.
	 */
	static fromTitle = (title: Title): ServiceTitle | undefined => {
		return undefined;
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
			const missingFields = (<typeof ServiceTitle>this.constructor).missingFields;
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
						`No ${ServiceTitle.missingFieldsMap[missingField]} available on ${
							(<typeof ServiceTitle>this.constructor).serviceName
						}`
					)
				);
			}
			DOM.append(parent, ...rows);
		} else DOM.append(parent, DOM.text('Not in List.'));
	};

	/**
	 * Compare the Media on the Service to a Title to check if it has the same progress.
	 * Avoid checking fields that cannot exist on the Service.
	 */
	isSynced = (title: Title): boolean => {
		const missingFields = (<typeof ServiceTitle>this.constructor).missingFields;
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

	import = (title: Title): void => {
		this.synced = true;
		this.status = title.status;
		this.progress.chapter = title.progress.chapter;
		if (title.progress.volume) {
			this.progress.volume = title.progress.volume;
		} else delete this.progress.volume;
		const missingFields = (<typeof ServiceTitle>this.constructor).missingFields;
		if (missingFields.indexOf('score') < 0) this.score = title.score;
		if (missingFields.indexOf('start') < 0 && title.start) {
			this.start = new Date(title.start);
		} else delete this.start;
		if (missingFields.indexOf('end') < 0 && title.end) {
			this.end = new Date(title.end);
		} else delete this.end;
	};

	export = (title: Title): void => {
		this.synced = true;
		title.status = this.status;
		title.progress.chapter = this.progress.chapter;
		if (this.progress.volume) {
			title.progress.volume = this.progress.volume;
		} else delete title.progress.volume;
		const missingFields = (<typeof ServiceTitle>this.constructor).missingFields;
		if (missingFields.indexOf('score') < 0 && this.score !== undefined) {
			title.score = this.score;
		} else title.score = 0;
		if (missingFields.indexOf('start') < 0 && this.start) {
			title.start = new Date(this.start);
		} else delete title.start;
		if (missingFields.indexOf('end') < 0 && this.end) {
			title.end = new Date(this.end);
		} else delete title.end;
	};
}

export type ServiceTitleList = Partial<{ [key in ActivableKey]: Promise<ServiceTitle | RequestStatus> }>;

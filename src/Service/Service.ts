import { Options } from '../Options';

export enum ServiceName {
	MyAnimeList = 'MyAnimeList',
	MangaUpdates = 'MangaUpdates',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	AnimePlanet = 'AnimePlanet',
}

export enum ServiceKey {
	MyAnimeList = 'mal',
	MangaUpdates = 'mu',
	Anilist = 'al',
	Kitsu = 'ku',
	AnimePlanet = 'ap',
}

export enum ServiceStatus {
	NONE,
	READING,
	COMPLETED,
	PAUSED,
	DROPPED,
	PLAN_TO_READ,
	REREADING,
	WONT_READ,
}

export abstract class Service {
	abstract name: string;
	abstract loggedIn: () => Promise<boolean>;
	abstract status: { [key in ServiceStatus]: number | string };
	options: Options;

	constructor(options: Options) {
		this.options = options;
	}
}

export abstract class HTMLService extends Service {
	document: Document;

	constructor(options: Options, document: Document) {
		super(options);
		this.document = document;
	}
}

export abstract class JSONService extends Service {
	document: Object;

	constructor(options: Options, document: Object) {
		super(options);
		this.document = document;
	}
}

import { AppendableElement, DOM } from './DOM';
import { Permissible } from './Permissible';
import { ExportModule, ImportModule } from './Module';
import { ModuleInterface } from './ModuleInterface';
import { MissableField } from './Title';

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

export type ServiceList = { [key in ActivableKey]?: MediaKey };

export const enum LoginMethod {
	EXTERNAL,
	FORM,
}

export abstract class Service extends Permissible {
	static readonly serviceName: ActivableName;
	static readonly key: ActivableKey;

	static readonly usesSlug: boolean = false;
	static readonly missingFields: MissableField[] = [];

	static readonly loginMethod: LoginMethod;
	static readonly loginUrl?: string;
	static readonly identifierField: [string, string] = ['Email', 'email'];

	static loggedIn = async (): Promise<RequestStatus> => {
		throw 'Service.loggedIn is an abstract function';
		return RequestStatus.FAIL;
	};
	static login?(username: string, password: string): Promise<RequestStatus>;
	static logout?(): Promise<void>;

	static importModule: (moduleInterface?: ModuleInterface) => ImportModule;
	static exportModule: (moduleInterface?: ModuleInterface) => ExportModule;

	static link = (key: MediaKey): string => {
		throw 'Service.link is an abstract function';
		return '';
	};
	static createTitle(): AppendableElement {
		return DOM.text(this.serviceName);
	}

	static compareId = (id1: MediaKey, id2: MediaKey): boolean => {
		return id1.id === id2.id && id1.slug === id2.slug;
	};
}

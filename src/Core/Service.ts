import { ActivableKey, ServiceKey, StaticKey } from '../Service/Keys';
import { ServiceName } from '../Service/Names';
import { AppendableElement, DOM } from './DOM';
import { ExportModule, ImportModule } from './Module';
import { ModuleInterface } from './ModuleInterface';
import { ExternalTitle, MissableField } from './Title';

export const enum LoginMethod {
	EXTERNAL,
	FORM,
}

export abstract class Service<K extends ServiceKey> {
	abstract name: ServiceName;
	abstract key: K;

	abstract link(key: MediaKey): string;
	createTitle = (): AppendableElement => {
		return DOM.text(this.name);
	};

	compareId = (id1: MediaKey, id2: MediaKey): boolean => {
		return Service.compareId(id1, id2);
	};

	static compareId(id1: MediaKey, id2: MediaKey): boolean {
		return id1.id === id2.id && id1.slug === id2.slug;
	}
}

export abstract class StaticService extends Service<StaticKey> {}

export abstract class ExternalService extends Service<ActivableKey> {
	// Enable if an ExternalTitle.key need to be updated after initial request
	updateKeyOnFirstFetch: boolean = false;
	usesSlug: boolean = false;
	missingFields: MissableField[] = [];

	abstract loginMethod: LoginMethod;
	loginUrl?: string;
	identifierField?: [string, string];

	abstract loggedIn(): Promise<RequestStatus>;
	abstract get(key: MediaKey): Promise<ExternalTitle | RequestStatus>;
	login?(username: string, password: string): Promise<RequestStatus>;
	logout?(): Promise<void>;

	abstract idFromLink(href: string): MediaKey;
	idFromString = (str: string): MediaKey => {
		return { id: parseInt(str) };
	};
}

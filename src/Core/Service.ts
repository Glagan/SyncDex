import { ActivableKey, ServiceKey, StaticKey } from '../Service/Keys';
import { ServiceName } from '../Service/Names';
import { AppendableElement, DOM } from './DOM';
import { Title, MissableField } from './Title';

export const enum LoginMethod {
	EXTERNAL,
	FORM,
}

export abstract class Service {
	abstract name: ServiceName;
	abstract key: ActivableKey;

	// Enable if an Title.key need to be updated after initial request
	updateKeyOnFirstFetch: boolean = false;
	usesSlug: boolean = false;

	abstract loginMethod: LoginMethod;
	loginUrl?: string;
	identifierField?: [string, string];

	abstract link(key: MediaKey): string;
	createTitle(): AppendableElement {
		return DOM.text(this.name);
	}

	abstract loggedIn(): Promise<ResponseStatus>;
	abstract get(key: MediaKey): Promise<Title | ResponseStatus>;
	login?(username: string, password: string): Promise<ResponseStatus>;
	logout?(): Promise<void>;

	abstract idFromLink(href: string): MediaKey;
	idFromString(str: string): MediaKey {
		return { id: parseInt(str) };
	}

	/**
	 * Check 2 MediaKey and return true if both the ids and slugs are equals
	 * @param id1 First MediaKey
	 * @param id2 Second MediaKey
	 */
	compareId(id1: MediaKey, id2: MediaKey): boolean {
		return (<typeof Service>this.constructor).compareId(id1, id2);
	}

	static compareId(id1: MediaKey, id2: MediaKey): boolean {
		return id1.id == id2.id && id1.slug == id2.slug;
	}
}

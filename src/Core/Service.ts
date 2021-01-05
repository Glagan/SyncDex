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

export abstract class Service {
	abstract name: ServiceName;
	abstract key: ActivableKey;

	usesSlug: boolean = false;
	missingFields: MissableField[] = [];

	abstract loginMethod: LoginMethod;
	loginUrl?: string;
	identifierField: [string, string] = ['Email', 'email'];

	abstract loggedIn(): Promise<RequestStatus>;
	abstract get(key: MediaKey): Promise<ExternalTitle | RequestStatus>;
	login?(username: string, password: string): Promise<RequestStatus>;
	logout?(): Promise<void>;

	importModule?: typeof ImportModule;
	createImportModule = (moduleInterface?: ModuleInterface): ImportModule | false => {
		if (!this.importModule) return false;
		const module = this.importModule;
		console.log('module', module);
		/// @ts-ignore
		return new module(this, moduleInterface);
	};
	exportModule?: typeof ExportModule;
	createExportModule = (moduleInterface?: ModuleInterface): ExportModule | false => {
		if (!this.exportModule) return false;
		const module = this.exportModule;
		console.log('module', module);
		/// @ts-ignore
		return new module(this, moduleInterface);
	};

	abstract link(key: MediaKey): string;
	createTitle = (): AppendableElement => {
		return DOM.text(this.name);
	};

	compareId = (id1: MediaKey, id2: MediaKey): boolean => {
		return Service.compareId(id1, id2);
	};

	abstract idFromLink(href: string): MediaKey;
	idFromString = (str: string): MediaKey => {
		return { id: parseInt(str) };
	};

	static compareId(id1: MediaKey, id2: MediaKey): boolean {
		return id1.id === id2.id && id1.slug === id2.slug;
	}
}

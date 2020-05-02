import { DOM } from '../../src/DOM';
import { MyMangaDex } from '../Service/MyMangaDex';
import { MangaDex } from '../Service/MangaDex';
import { SyncDex } from '../Service/SyncDex';
import { MyAnimeList } from '../Service/MyAnimeList';
import { Anilist } from '../Service/Anilist';
import { Kitsu } from '../Service/Kitsu';
import { AnimePlanet } from '../Service/AnimePlanet';
import { MangaUpdates } from '../Service/MangaUpdates';
import { ServiceSave } from '../Service/Save';

export abstract class SaveManager {
	node: HTMLElement;
	reload: () => void;
	abstract services: ServiceSave[];
	abstract mainHeader: string;

	constructor(node: HTMLElement, reload: () => void) {
		this.node = node;
		this.reload = reload;
	}

	header = (value: string): HTMLElement => {
		return this.node.appendChild(
			DOM.create('h2', {
				class: 'full',
				textContent: value,
			})
		);
	};

	clear = (): void => {
		DOM.clear(this.node);
	};

	reset = (): void => {
		this.clear();
		this.header(`Select the Service you want to ${this.mainHeader}`);
		const serviceList = DOM.create('div', { class: 'services selectable' });
		for (const service of this.services) {
			DOM.append(serviceList, service.createBlock());
			this.bind(service);
		}
		DOM.append(this.node, serviceList);
	};

	abstract bind(service: ServiceSave): void;
}

export class SaveImportManager extends SaveManager {
	mainHeader: string = 'Import from';
	services: ServiceSave[] = [
		new MyMangaDex(this),
		new SyncDex(this),
		new MangaDex(this),
		new MyAnimeList(this),
		new Anilist(this),
		new Kitsu(this),
		new AnimePlanet(this),
		new MangaUpdates(this),
	];

	constructor(node: HTMLElement, reload: () => void) {
		super(node, reload);
		this.reset();
	}

	bind = (service: ServiceSave): void => {
		if (service.import) {
			/// @ts-ignore
			service.block.addEventListener('click', () => service.import(this));
		}
	};
}

export class SaveExportManager extends SaveManager {
	mainHeader: string = 'Export to';
	services: ServiceSave[] = [
		new SyncDex(this),
		new MangaDex(this),
		new MyAnimeList(this),
		new Anilist(this),
		new Kitsu(this),
		new AnimePlanet(this),
		new MangaUpdates(this),
	];

	constructor(node: HTMLElement, reload: () => void) {
		super(node, reload);
		this.reset();
	}

	bind = (service: ServiceSave): void => {
		if (service.export) {
			/// @ts-ignore
			service.block.addEventListener('click', () => service.export(this));
		}
	};
}

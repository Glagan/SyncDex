import { DOM } from '../../src/DOM';
import { MyMangaDex } from '../Save/MyMangaDex';
import { MangaDex } from '../Save/MangaDex';
import { SyncDex } from '../Save/SyncDex';
import { MyAnimeList } from '../Save/MyAnimeList';
import { Anilist } from '../Save/Anilist';
import { Kitsu } from '../Save/Kitsu';
import { AnimePlanet } from '../Save/AnimePlanet';
import { MangaUpdates } from '../Save/MangaUpdates';
import { ServiceSave } from '../Save/Save';

export abstract class SaveManager {
	node: HTMLElement;
	reload: () => void;
	abstract services: ServiceSave[];
	abstract mainHeader: string;

	constructor(node: HTMLElement, reload: () => void) {
		this.node = node;
		this.reload = reload;
	}

	header = (value: string): void => {
		this.node.appendChild(
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

	form = (
		fields: {
			type: 'checkbox' | 'input' | 'file';
			text?: string;
			name: string;
		}[],
		callback: (event: Event) => void
	): HTMLFormElement => {
		const form = DOM.create('form', { class: 'block' });
		for (let index = 0; index < fields.length; index++) {
			const field = fields[index];
			if (field.type == 'checkbox') {
				const row = DOM.create('div', { class: 'row' });
				const label = DOM.create('label', {
					textContent: field.text || '',
				});
				const hiddenCheckbox = DOM.create('input', {
					class: 'hidden',
					attributes: {
						name: field.name,
						type: 'checkbox',
					},
				});
				const checkbox = DOM.create('div', { class: 'checkbox disabled' });
				const enable = DOM.create('button', { class: 'on', textContent: 'Enable' });
				const disable = DOM.create('button', {
					class: 'off',
					textContent: 'Disable',
				});
				label.addEventListener('click', () => {
					if (hiddenCheckbox.checked) {
						checkbox.classList.remove('enabled');
						checkbox.classList.add('disabled');
						hiddenCheckbox.checked = false;
					} else {
						checkbox.classList.remove('disabled');
						checkbox.classList.add('enabled');
						hiddenCheckbox.checked = true;
					}
				});
				enable.addEventListener('click', (event) => {
					event.preventDefault();
					checkbox.classList.remove('disabled');
					checkbox.classList.add('enabled');
					hiddenCheckbox.checked = true;
				});
				disable.addEventListener('click', (event) => {
					event.preventDefault();
					checkbox.classList.remove('enabled');
					checkbox.classList.add('disabled');
					hiddenCheckbox.checked = false;
				});
				DOM.append(checkbox, enable, disable);
				DOM.append(form, DOM.append(row, label, hiddenCheckbox, checkbox));
			} else if (field.type == 'file') {
				DOM.append(
					form,
					DOM.create('input', {
						class: 'button action mr-1',
						attributes: {
							name: 'file',
							type: 'file',
						},
					})
				);
			}
		}
		DOM.append(
			form,
			DOM.create('button', {
				class: 'success mr-1',
				textContent: 'Send',
				attributes: { type: 'submit' },
			}),
			DOM.create('button', {
				class: 'danger',
				textContent: 'Cancel',
				events: {
					click: () => this.reset(),
				},
			})
		);
		form.addEventListener('submit', callback);
		DOM.append(this.node, form);
		return form;
	};

	uploadForm = (callback: (event: Event) => void): HTMLFormElement => {
		const form = DOM.create('form', { class: 'block' });
		const fileInput = DOM.create('input', {
			class: 'button action mr-1',
			attributes: {
				name: 'file',
				type: 'file',
			},
		});
		const sendButton = DOM.create('button', {
			class: 'success',
			textContent: 'Send',
			attributes: { type: 'submit' },
		});
		form.addEventListener('submit', callback);
		DOM.append(this.node, DOM.append(form, fileInput, sendButton));
		return form;
	};
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

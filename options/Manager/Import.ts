import { DOM } from '../../src/DOM';
import { ImportableService, ServiceImport } from '../Import/ServiceImport';
import { ServiceImportClass } from '../Import/ServiceImportClass';
import { Options } from '../../src/Options';

/*const services: {
	[key in Importab]: ServiceImport;
} = {
	MyMangaDex: {
		key: 'mmd',
		steps: {
			start: (service, manager): void => {
				manager.clear();
				manager.header('Select your MyMangaDex save file');
				const form = manager.form(
					[
						{
							type: 'checkbox',
							text: 'Override instead of merge',
							name: 'override',
						},
						{
							type: 'file',
							name: 'file',
						},
					],
					(event) => {
						event.preventDefault();
						console.log(form.file.value);
						var reader = new FileReader();
						reader.onload = () => {
							// Import
							let data = JSON.parse(reader.result);
						};
						reader.readAsText(form.save.files[0]);
					}
				);
			},
		},
		title: () => {
			return DOM.create('span', {
				class: 'mymangadex',
				textContent: 'My',
				childs: [
					DOM.create('span', {
						class: 'mangadex',
						textContent: 'MangaDex',
					}),
				],
			});
		},
	},
	SyncDex: {
		key: 'sc',
		steps: {
			start: (manager): void => {},
		},
	},
	MangaDex: {
		key: 'md',
		steps: {
			start: (manager): void => {},
		},
	},
	MyAnimeList: {
		key: 'mal',
		steps: {
			start: (manager): void => {},
		},
	},
	Anilist: {
		key: 'al',
		steps: {
			start: (manager): void => {},
		},
		title: () => {
			return DOM.create('span', {
				class: 'anilist',
				textContent: 'Ani',
				childs: [
					DOM.create('span', {
						class: 'list',
						textContent: 'list',
					}),
				],
			});
		},
	},
	Kitsu: {
		key: 'ku',
		steps: {
			start: (manager): void => {},
		},
	},
	AnimePlanet: {
		key: 'ap',
		steps: {
			start: (manager): void => {},
		},
	},
	MangaUpdates: {
		key: 'mu',
		steps: {
			start: (manager): void => {},
		},
	},
};*/

export class ImportManager {
	node: HTMLElement;
	options: Options;
	list: { [key in ImportableService]: ServiceImport };

	constructor(node: HTMLElement, options: Options) {
		this.node = node;
		this.options = options;
		this.list = {} as any;
		Object.keys(ImportableService).forEach((value) => {
			this.list[value as ImportableService] = ServiceImportClass(
				value as ImportableService,
				this
			);
		});
		this.reset();
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
		this.header('Select the Service you want to Import from');
		const serviceList = DOM.create('div', { class: 'services selectable' });
		Object.keys(ImportableService).forEach((value) => {
			DOM.append(serviceList, this.serviceBlock(value as ImportableService));
		});
		DOM.append(this.node, serviceList);
	};

	serviceBlock = (service: ImportableService): HTMLElement => {
		const block = DOM.create('div', { class: 'service' });
		const title = DOM.create('span', {
			class: 'title',
			childs: [
				DOM.create('img', { attributes: { src: `/icons/${this.list[service].key}.png` } }),
				DOM.space(),
				this.list[service].title(),
			],
		});
		block.addEventListener('click', () => this.list[service].start());
		return DOM.append(block, title);
	};

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
				const disable = DOM.create('button', { class: 'off', textContent: 'Disable' });
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

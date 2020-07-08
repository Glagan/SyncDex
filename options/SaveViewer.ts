import { Title, TitleCollection } from '../src/Title';
import { DOM, AppendableElement } from '../src/DOM';
import { LocalStorage } from '../src/Storage';
import { MyAnimeListTitle } from '../src/Service/MyAnimeList';
import { AnilistTitle } from '../src/Service/Anilist';
import { KitsuTitle } from '../src/Service/Kitsu';
import { AnimePlanetTitle } from '../src/Service/AnimePlanet';
import { MangaUpdatesTitle } from '../src/Service/MangaUpdates';
import { Modal } from './Modal';

export class SaveViewer {
	paging: HTMLElement;
	pagingPages: HTMLElement;
	body: HTMLElement;
	reloadButton: HTMLButtonElement;
	titles: TitleCollection = new TitleCollection();
	currentPage: number = 1;
	maxPage: number = 1;
	previousPage: HTMLButtonElement;
	pages: { [key: number]: HTMLButtonElement } = {};
	static perPage = 10;

	static statusMap: { [key in Status]: string } = {
		[Status.NONE]: 'NONE',
		[Status.READING]: 'READING',
		[Status.COMPLETED]: 'COMPLETED',
		[Status.PAUSED]: 'PAUSED',
		[Status.PLAN_TO_READ]: 'PLAN_TO_READ',
		[Status.DROPPED]: 'DROPPED',
		[Status.REREADING]: 'REREADING',
		[Status.WONT_READ]: 'WONT_READ',
	};

	constructor() {
		this.paging = document.getElementById('save-paging') as HTMLElement;
		this.pagingPages = document.getElementById('paging-pages') as HTMLElement;
		this.body = document.getElementById('save-body') as HTMLElement;
		this.reloadButton = document.getElementById('reload-save-viewer') as HTMLButtonElement;
		this.previousPage = DOM.create('button');
		this.reloadButton.addEventListener('click', (event) => {
			event.preventDefault();
			this.updateAll();
		});
		this.updateAll();
	}

	loadPage = (page: number): void => {
		DOM.clear(this.body);
		this.currentPage = page;
		let titles = this.titles.collection.slice(SaveViewer.perPage * (page - 1), page * SaveViewer.perPage);
		const fragment = document.createDocumentFragment();
		for (const title of titles) {
			fragment.appendChild(this.createRow(title));
		}
		this.body.appendChild(fragment);
	};

	serviceLink = (key: ServiceKey, id: number | AnimePlanetReference): string => {
		switch (key) {
			case 'mal':
				return MyAnimeListTitle.link(id as number);
			case 'al':
				return AnilistTitle.link(id as number);
			case 'ku':
				return KitsuTitle.link(id as number);
			case 'ap':
				return AnimePlanetTitle.link(id as AnimePlanetReference);
			case 'mu':
				return MangaUpdatesTitle.link(id as number);
		}
		return '#';
	};

	titleServices = (title: Title): AppendableElement[] => {
		const icons: AppendableElement[] = [];
		for (const serviceKey in title.services) {
			const key = serviceKey as ServiceKey;
			icons.push(
				DOM.create('a', {
					attributes: {
						target: '_blank',
						href: this.serviceLink(key, title.services[key] as number | AnimePlanetReference),
						rel: 'noreferrer noopener',
					},
					childs: [DOM.create('img', { attributes: { src: `/icons/${serviceKey}.png` } })],
				})
			);
		}
		if (icons.length == 0) {
			icons.push(DOM.text('-'));
		}
		return icons;
	};

	zeroPad = (n: number): string => {
		return ('00' + n).slice(-2);
	};

	dateFormat = (timestamp: number): string => {
		const d = new Date(timestamp);
		return `${d.getFullYear()}-${this.zeroPad(d.getMonth() + 1)}-${this.zeroPad(d.getDate())}`;
		// `${this.zeroPad(d.getHours())}:${this.zeroPad(d.getMinutes())}:${this.zeroPad(d.getSeconds())}`;
	};

	statusOptions = (title: Title): HTMLSelectElement => {
		const select = DOM.create('select', { attributes: { required: 'true' } });
		const currentStatus = SaveViewer.statusMap[title.status];
		for (const status of Object.values(SaveViewer.statusMap)) {
			const option = DOM.create('option', { textContent: status, attributes: { value: status } });
			if (currentStatus == status) option.selected = true;
			select.appendChild(option);
		}
		return select;
	};

	modalRow = (content: AppendableElement[]): HTMLElement => {
		return DOM.create('div', { class: 'row', childs: content });
	};

	modalGroup = (title: string, content: string | AppendableElement[]): HTMLElement => {
		return DOM.create('div', {
			class: 'group',
			childs: [
				DOM.create('label', { textContent: title }),
				...(typeof content === 'string' ? [DOM.text(content)] : content),
			],
		});
	};

	createRow = (title: Title): HTMLElement => {
		const editButton = DOM.create('button', { class: 'ghost', childs: [DOM.icon('edit')] });
		const deleteButton = DOM.create('button', { class: 'ghost', childs: [DOM.icon('trash')] });
		const row = DOM.create('tr', {
			childs: [
				DOM.create('td', {
					class: 'mangadex',
					childs: [
						DOM.create('a', {
							textContent: title.id.toString(),
							attributes: {
								target: '_blank',
								href: `https://mangadex.org/title/${title.id}`,
								rel: 'noreferrer noopener',
							},
							childs: [DOM.space(), DOM.icon('external-link-alt')],
						}),
					],
				}),
				DOM.create('td', {
					class: 'name',
					textContent: title.name ? title.name : '-',
					attributes: { title: title.name ? title.name : '-' },
				}),
				DOM.create('td', { childs: this.titleServices(title) }),
				DOM.create('td', { textContent: SaveViewer.statusMap[title.status] }),
				DOM.create('td', { textContent: title.score ? title.score.toString() : '-' }),
				DOM.create('td', {
					textContent: `Ch. ${title.progress.chapter}${
						title.progress.volume ? ` Vol. ${title.progress.volume}` : ''
					}`,
				}),
				DOM.create('td', { textContent: title.start ? this.dateFormat(title.start) : '-' }),
				DOM.create('td', { textContent: title.end ? this.dateFormat(title.end) : '-' }),
				DOM.create('td', {
					class: 'actions',
					childs: [editButton, deleteButton],
				}),
			],
		});
		editButton.addEventListener('click', async (event) => {
			const modal = new Modal('medium');
			modal.header.classList.add('title');
			modal.header.textContent = 'Edit Entry';
			const cancelButton = DOM.create('button', {
				class: 'default',
				childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
				events: {
					click: (event) => {
						event.preventDefault();
						modal.remove();
					},
				},
			});
			const form = DOM.create('form', { class: 'save-entry' });
			DOM.append(
				form,
				this.modalRow([
					this.modalGroup('MangaDex', [
						DOM.create('span', { class: 'helper', textContent: `# ${title.id}` }),
					]),
					this.modalGroup('Name', [
						DOM.create('input', {
							attributes: { type: 'text', placeholder: 'Name', value: title.name ? title.name : '' },
						}),
					]),
				]),
				this.modalRow([
					this.modalGroup('Chapter', [
						DOM.create('input', {
							attributes: {
								type: 'number',
								placeholder: 'Chapter',
								value: `${title.progress.chapter}`,
								required: 'true',
							},
						}),
					]),
					this.modalGroup('Volume', [
						DOM.create('input', {
							attributes: {
								type: 'number',
								placeholder: 'Volume',
								value: title.progress.volume ? `${title.progress.volume}` : '',
							},
						}),
					]),
				]),
				this.modalRow([
					this.modalGroup('Status', [this.statusOptions(title)]),
					this.modalGroup('Score (0-100)', [
						DOM.create('input', {
							attributes: {
								type: 'number',
								placeholder: 'Score (0-100)',
								min: '0',
								max: '100',
								value: title.score > 0 ? `${title.score}` : '',
							},
						}),
					]),
				]),
				this.modalRow([
					this.modalGroup('Start', [
						DOM.create('input', {
							attributes: {
								type: 'date',
								placeholder: 'Start Date',
								value: title.start ? this.dateFormat(title.start) : '',
							},
						}),
					]),
					this.modalGroup('End', [
						DOM.create('input', {
							attributes: {
								type: 'date',
								placeholder: 'End Date',
								value: title.end ? this.dateFormat(title.end) : '',
							},
						}),
					]),
				]),
				DOM.create('div', {
					childs: [
						DOM.create('button', {
							class: 'primary puffy',
							childs: [DOM.icon('save'), DOM.text('Save')],
						}),
						cancelButton,
					],
				})
			);
			form.addEventListener('submit', (event) => {
				event.preventDefault();
			});
			modal.body.appendChild(form);
			modal.show();
		});
		deleteButton.addEventListener('click', async (event) => {
			event.preventDefault();
			deleteButton.disabled = true;
			deleteButton.classList.add('loading');
			await LocalStorage.remove(title.id);
			this.titles.remove(title.id);
			row.remove();
			// Remove page buttons and load new pages if necessary
			const oldMax = this.maxPage;
			this.maxPage = Math.floor(this.titles.length / SaveViewer.perPage);
			if (oldMax > this.maxPage) {
				this.pages[oldMax].remove();
				delete this.pages[oldMax];
			}
			if (this.currentPage < this.maxPage) {
				this.loadPage(this.currentPage);
			} else if (this.maxPage > 1 && oldMax > this.maxPage && this.currentPage == oldMax) {
				this.previousPage = this.pages[this.maxPage];
				this.previousPage.classList.add('active');
				this.previousPage.disabled = true;
				this.loadPage(this.currentPage - 1);
			}
		});
		return row;
	};

	updateAll = async (): Promise<void> => {
		DOM.clear(this.pagingPages);
		DOM.clear(this.body);
		this.titles = await TitleCollection.get();
		this.currentPage = 1;
		this.pages = {};
		this.maxPage = Math.floor(this.titles.length / SaveViewer.perPage);
		for (let i = 0; i < this.maxPage; i++) {
			const button = DOM.create('button', { class: 'ghost paging', textContent: `${i + 1}` });
			button.addEventListener('click', (event) => {
				this.previousPage.classList.remove('active');
				this.previousPage.disabled = false;
				button.classList.add('active');
				button.disabled = true;
				this.previousPage = button;
				this.loadPage(i + 1);
			});
			if (i == 0) {
				this.previousPage = button;
				this.previousPage.disabled = true;
				this.previousPage.classList.add('active');
			}
			this.pages[i + 1] = button;
			this.pagingPages.appendChild(button);
		}
		this.loadPage(1);
	};
}

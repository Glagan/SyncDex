import { TitleCollection, ReverseServiceName, ActivableKey, StatusMap, Title } from '../Core/Title';
import { DOM, AppendableElement } from '../Core/DOM';
import { LocalStorage } from '../Core/Storage';
import { GetService } from './Manager/Service';
import { dateFormat, progressToString } from '../Core/Utility';
import { SaveEditor } from '../Core/SaveEditor';

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
	emptySave: HTMLElement;

	constructor() {
		this.paging = document.getElementById('save-paging')!;
		this.pagingPages = document.getElementById('paging-pages')!;
		this.body = document.getElementById('save-body')!;
		this.reloadButton = document.getElementById('reload-save-viewer') as HTMLButtonElement;
		this.previousPage = DOM.create('button');
		this.emptySave = DOM.create('tr', {
			childs: [
				DOM.create('td', {
					colSpan: 9,
					childs: [
						DOM.create('div', {
							class: 'message',
							childs: [
								DOM.create('div', { class: 'icon' }),
								DOM.create('div', {
									class: 'content',
									textContent: 'Nothing in your Save.',
								}),
							],
						}),
					],
				}),
			],
		});
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

	titleServices = (title: Title): AppendableElement[] => {
		const icons: AppendableElement[] = [];
		for (const serviceKey in title.services) {
			const key = serviceKey as ActivableKey;
			const name = ReverseServiceName[key];
			icons.push(
				DOM.create('a', {
					target: '_blank',
					href: GetService(name).link(title.services[key]!),
					childs: [DOM.create('img', { src: `/icons/${serviceKey}.png` })],
				})
			);
		}
		if (icons.length == 0) {
			icons.push(DOM.text('-'));
		}
		return icons;
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
							target: '_blank',
							href: `https://mangadex.org/title/${title.id}`,
							childs: [DOM.space(), DOM.icon('external-link-alt')],
						}),
					],
				}),
				DOM.create('td', {
					class: 'name',
					textContent: title.name ? title.name : '-',
					title: title.name ? title.name : '-',
				}),
				DOM.create('td', { childs: this.titleServices(title) }),
				DOM.create('td', { textContent: StatusMap[title.status] }),
				DOM.create('td', { textContent: title.score ? title.score.toString() : '-' }),
				DOM.create('td', { textContent: progressToString(title.progress) }),
				DOM.create('td', { textContent: title.start ? dateFormat(title.start) : '-' }),
				DOM.create('td', { textContent: title.end ? dateFormat(title.end) : '-' }),
				DOM.create('td', {
					class: 'actions',
					childs: [editButton, deleteButton],
				}),
			],
		});
		editButton.addEventListener('click', async (event) => {
			event.preventDefault();
			SaveEditor.create(title, () => {
				this.loadPage(this.currentPage);
			}).show();
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
			this.maxPage = Math.ceil(this.titles.length / SaveViewer.perPage);
			if (oldMax > this.maxPage) {
				this.pages[oldMax].remove();
				delete this.pages[oldMax];
			}
			if (this.maxPage > 1 && oldMax > this.maxPage && this.currentPage == oldMax) {
				this.previousPage = this.pages[this.maxPage];
				this.previousPage.classList.add('active');
				this.previousPage.disabled = true;
				this.loadPage(this.currentPage - 1);
			} else if (this.currentPage <= this.maxPage) {
				this.loadPage(this.currentPage);
			}
			if (this.titles.length == 0) this.body.appendChild(this.emptySave);
		});
		return row;
	};

	updateAll = async (): Promise<void> => {
		DOM.clear(this.pagingPages);
		DOM.clear(this.body);
		this.titles = await TitleCollection.get();
		this.currentPage = 1;
		this.pages = {};
		this.maxPage = Math.ceil(this.titles.length / SaveViewer.perPage);
		if (this.maxPage > 0) {
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
		} else this.body.appendChild(this.emptySave);
	};
}

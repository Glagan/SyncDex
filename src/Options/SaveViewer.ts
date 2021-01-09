import { StatusMap } from '../Core/Title';
import { DOM, AppendableElement } from '../Core/DOM';
import { Storage } from '../Core/Storage';
import { dateFormat, progressToString } from '../Core/Utility';
import { TitleEditor } from '../Core/TitleEditor';
import { SyncModule } from '../Core/SyncModule';
import { Services } from '../Service/Class/Map';
import { Runtime } from '../Core/Runtime';
import { ActivableKey } from '../Service/Keys';
import { LocalTitle, TitleCollection } from '../Core/Title';
import { MangaDex } from '../Core/MangaDex';

interface SaveRow {
	title: LocalTitle;
	node: HTMLElement;
	checkbox: HTMLInputElement;
	selected: boolean;
}

export class SaveViewer {
	pagingPages: HTMLElement;
	body: HTMLElement;
	reloadButton: HTMLButtonElement;
	realTitles: TitleCollection = new TitleCollection();
	titles: TitleCollection = new TitleCollection();
	currentPage: number = 1;
	maxPage: number = 1;
	previousPage: HTMLButtonElement;
	pages: { [key: number]: HTMLButtonElement } = {};
	static perPage = 15;
	emptySaveMessage: HTMLElement;
	emptySave: HTMLElement;
	selectAllCheckbox: HTMLInputElement;
	deleteSelected: HTMLElement;
	displayedRows: SaveRow[] = [];
	statusSelect: HTMLSelectElement;
	searchInput: HTMLInputElement;
	resetSearch: HTMLElement;
	idColumn: HTMLElement;
	sortFieldIcon: HTMLElement;
	sortBy: { search: string; status: Status | undefined; field: keyof LocalTitle; order: 'ASC' | 'DESC' } = {
		search: '',
		status: undefined,
		field: 'key',
		order: 'ASC',
	};
	// MangaDex login status for SyncModule
	static loggedIn = false;

	constructor() {
		this.pagingPages = document.getElementById('paging-pages')!;
		this.body = document.getElementById('save-body')!;
		this.reloadButton = document.getElementById('reload-save-viewer') as HTMLButtonElement;
		this.previousPage = DOM.create('button');
		this.emptySaveMessage = DOM.create('div', {
			class: 'content',
			textContent: 'Nothing in your Save.',
		});
		this.emptySave = DOM.create('tr', {
			childs: [
				DOM.create('td', {
					colSpan: 10,
					childs: [
						DOM.create('div', {
							class: 'message',
							childs: [DOM.create('div', { class: 'icon' }), this.emptySaveMessage],
						}),
					],
				}),
			],
		});

		this.selectAllCheckbox = document.getElementById('save_all') as HTMLInputElement;
		this.selectAllCheckbox.addEventListener('change', () => {
			for (const row of this.displayedRows) {
				row.selected = this.selectAllCheckbox.checked;
				row.checkbox.checked = this.selectAllCheckbox.checked;
			}
			if (this.selectAllCheckbox.checked) {
				this.deleteSelected.style.display = 'block';
			} else this.deleteSelected.style.display = 'none';
		});
		this.deleteSelected = document.getElementById('delete-selected') as HTMLElement;
		this.deleteSelected.addEventListener('click', async (event) => {
			const ids: string[] = [];
			for (const row of this.displayedRows) {
				if (row.selected) {
					ids.push(`${row.title.key.id}`);
					this.realTitles.remove(row.title.key.id!);
					this.titles.remove(row.title.key.id!);
				}
			}
			await Storage.remove(ids);
			this.updateDisplayedPage();
		});

		this.statusSelect = document.getElementById('save-status') as HTMLSelectElement;
		let value = 0;
		for (const status of Object.values(StatusMap)) {
			const option = DOM.create('option', { textContent: status, value: `${value++}` });
			this.statusSelect.appendChild(option);
		}
		this.statusSelect.addEventListener('change', () => {
			if (this.statusSelect.value == '-1') {
				this.sortBy.status = undefined;
			} else this.sortBy.status = parseInt(this.statusSelect.value);
			this.updateAll(false);
		});

		this.searchInput = document.getElementById('save-search') as HTMLInputElement;
		let timeout = 0;
		this.searchInput.addEventListener('input', (event) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				this.sortBy.search = this.searchInput.value;
				this.updateAll(false);
			}, 200);
		});
		this.resetSearch = document.getElementById('reset-search') as HTMLElement;
		this.resetSearch.addEventListener('click', (event) => {
			event.preventDefault();
			if (this.searchInput.value != '') {
				this.searchInput.value = '';
				this.sortBy.search = '';
				this.updateAll(false);
			}
		});

		this.sortFieldIcon = DOM.icon('angle-up');
		this.idColumn = document.querySelector<HTMLElement>('th[data-field="key"]')!;
		this.idColumn.appendChild(this.sortFieldIcon);
		const sortColumns = document.querySelectorAll<HTMLElement>('th[data-field]');
		for (const column of sortColumns) {
			const field = column.dataset.field!;
			column.addEventListener('click', (event) => {
				if (this.sortBy.field == field) {
					this.sortBy.order = this.sortBy.order == 'ASC' ? 'DESC' : 'ASC';
					this.sortFieldIcon.classList.toggle('fa-angle-down');
					this.sortFieldIcon.classList.toggle('fa-angle-up');
				} else {
					column.appendChild(this.sortFieldIcon);
					this.sortFieldIcon.classList.remove('fa-angle-down');
					this.sortFieldIcon.classList.add('fa-angle-up');
					this.sortBy.field = field as keyof LocalTitle;
					this.sortBy.order = 'ASC';
				}
				this.sortTitles();
				this.updateDisplayedPage();
			});
		}

		this.reloadButton.addEventListener('click', (event) => {
			event.preventDefault();
			this.sortBy = { search: '', status: undefined, field: 'key', order: 'ASC' };
			this.statusSelect.value = '-1';
			this.searchInput.value = '';
			this.idColumn.appendChild(this.sortFieldIcon);
			this.sortFieldIcon.classList.remove('fa-angle-down');
			this.sortFieldIcon.classList.add('fa-angle-up');
			this.updateAll(true);
		});

		this.updateAll(true);
	}

	loadPage = (page: number): void => {
		DOM.clear(this.body);
		this.selectAllCheckbox.checked = false;
		this.deleteSelected.style.display = 'none';
		this.currentPage = page;
		this.displayedRows = [];
		let titles = this.titles.slice(SaveViewer.perPage * (page - 1), page * SaveViewer.perPage);
		const fragment = document.createDocumentFragment();
		for (const title of titles) {
			const row = this.createRow(title);
			this.displayedRows.push(row);
			fragment.appendChild(row.node);
		}
		this.body.appendChild(fragment);
	};

	titleServices = (title: LocalTitle): AppendableElement[] => {
		const icons: AppendableElement[] = [];
		for (const serviceKey in title.services) {
			const key = serviceKey as ActivableKey;
			icons.push(
				DOM.create('a', {
					target: '_blank',
					href: Services[key].link(title.services[key]!),
					childs: [DOM.create('img', { src: Runtime.icon(serviceKey) })],
				})
			);
		}
		if (icons.length == 0) {
			icons.push(DOM.text('-'));
		}
		return icons;
	};

	/**
	 * Remove page buttons and load new pages if necessary
	 */
	updateDisplayedPage = (): void => {
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
	};

	createRow = (title: LocalTitle): SaveRow => {
		const selectCheckbox = DOM.create('input', { type: 'checkbox', id: `save_${title.key.id}` });
		const editButton = DOM.create('button', { class: 'ghost', childs: [DOM.icon('edit')], title: 'Edit' });
		const deleteButton = DOM.create('button', { class: 'ghost', childs: [DOM.icon('trash')], title: 'Delete' });
		const row = DOM.create('tr', {
			childs: [
				DOM.create('td', {
					childs: [selectCheckbox, DOM.create('label', { htmlFor: `save_${title.key.id}` })],
				}),
				DOM.create('td', {
					class: 'mangadex',
					childs: [
						DOM.create('a', {
							textContent: title.key.id!.toString(),
							target: '_blank',
							href: MangaDex.link(title.key),
							childs: [DOM.space(), DOM.icon('external-link-alt')],
						}),
					],
				}),
				DOM.create('td', {
					class: 'data name',
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
			const syncModule = new SyncModule(title);
			syncModule.loggedIn = SaveViewer.loggedIn;
			syncModule.initialize();
			let removed = false;
			TitleEditor.create(
				syncModule,
				() => this.loadPage(this.currentPage),
				() => {
					removed = true;
					this.realTitles.remove(title.key.id!);
					this.titles.remove(title.key.id!);
					this.updateDisplayedPage();
				},
				async () => {
					const page = this.currentPage;
					if (removed) await this.updateAll(true);
					this.loadPage(page);
				}
			).show();
		});
		// Delete button in list only delete in Local Storage
		let deletePrevention: [number, SimpleNotification] | undefined = undefined;
		deleteButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (deletePrevention !== undefined) {
				clearTimeout(deletePrevention[0]);
				deletePrevention[1].close();
				deleteButton.classList.add('loading');
				await Storage.remove(title.key.id!);
				this.titles.remove(title.key.id!);
				row.remove();
				this.updateDisplayedPage();
			} else {
				deletePrevention = [
					setTimeout(() => {
						deletePrevention = undefined;
					}, 4000),
					SimpleNotification.warning(
						{
							title: 'Confirm',
							text: 'Click the **Delete** button again to confirm.',
						},
						{ duration: 4000, pauseOnHover: false }
					),
				];
			}
		});
		const saveRow: SaveRow = {
			title: title,
			node: row,
			checkbox: selectCheckbox,
			selected: false,
		};
		selectCheckbox.addEventListener('change', (event) => {
			saveRow.selected = selectCheckbox.checked;
			if (selectCheckbox.checked) {
				this.deleteSelected.style.display = 'block';
			} else {
				this.selectAllCheckbox.checked = false;
				for (const row of this.displayedRows) {
					if (row.selected) return;
				}
				this.deleteSelected.style.display = 'none';
			}
		});
		return saveRow;
	};

	sortTitles = (): void => {
		const order = this.sortBy.order == 'ASC' ? 1 : -1;
		if (this.sortBy.field == 'key') {
			this.titles.sort((a, b) => (a.key.id! > b.key.id! ? order : -order));
		} else if (this.sortBy.field == 'start' || this.sortBy.field == 'end') {
			this.titles.sort((a, b) => {
				if (a[this.sortBy.field] === undefined && b[this.sortBy.field] === undefined) {
					return 0;
				} else if (a[this.sortBy.field] == undefined) {
					return 1;
				} else if (b[this.sortBy.field] == undefined) {
					return -1;
				}
				return a[this.sortBy.field]! > b[this.sortBy.field]! ? order : -order;
			});
		} else this.titles.sort((a, b) => (a[this.sortBy.field]! > b[this.sortBy.field]! ? order : -order));
	};

	updateAll = async (reload: boolean): Promise<void> => {
		DOM.clear(this.pagingPages);
		DOM.clear(this.body);
		if (reload) {
			const response = await Runtime.jsonRequest({
				url: MangaDex.api('me'),
				credentials: 'include',
			});
			SaveViewer.loggedIn = response.ok;
			this.realTitles = await TitleCollection.get();
		}
		this.titles.collection = Array.from(this.realTitles.collection);
		if (this.sortBy.search !== '') {
			const search = this.sortBy.search.toLocaleLowerCase();
			this.titles.collection = this.titles.collection.filter(
				(t) =>
					(typeof t.name === 'string' && t.name.toLocaleLowerCase().match(search)) ||
					`${t.key.id}` == search ||
					Object.values(t.services).some((key) => key && (`${key.id}` == search || key.slug == search))
			);
		}
		if (this.sortBy.status !== undefined) {
			this.titles.collection = this.titles.collection.filter((t) => t.status === this.sortBy.status);
		}
		if (this.sortBy.field != 'key' || this.sortBy.order != 'DESC') {
			this.sortTitles();
		}
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
		} else {
			if (this.sortBy.search == '') {
				this.emptySaveMessage.textContent = 'Nothing in your Save.';
			} else {
				this.emptySaveMessage.textContent = 'Nothing found in your Save !';
			}
			this.body.appendChild(this.emptySave);
		}
	};
}

import {
	TitleCollection,
	ServiceKey,
	ActivableName,
	ServiceName,
	ReverseServiceName,
	ActivableKey,
	StatusMap,
	Title,
} from '../Core/Title';
import { DOM, AppendableElement } from '../Core/DOM';
import { LocalStorage } from '../Core/Storage';
import { Modal } from './Modal';
import { GetService } from './Manager/Service';
import { dateFormat, dateFormatInput, progressToString } from '../Core/Utility';

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

	statusOptions = (title: Title): HTMLSelectElement => {
		const select = DOM.create('select', { id: 'ee_status', name: 'status', required: true });
		let value = 0;
		for (const status of Object.values(StatusMap)) {
			const option = DOM.create('option', { textContent: status, value: `${value}` });
			if (title.status == value++) option.selected = true;
			select.appendChild(option);
		}
		return select;
	};

	modalRow = (content: AppendableElement[]): HTMLElement => {
		return DOM.create('div', { class: 'row', childs: content });
	};

	modalGroup = (title: string, inputFor: string, content: string | AppendableElement[]): HTMLElement => {
		return DOM.create('div', {
			class: 'group',
			childs: [
				DOM.create('label', { textContent: title, htmlFor: inputFor }),
				...(typeof content === 'string' ? [DOM.text(content)] : content),
			],
		});
	};

	createModal = (title: Title): Modal => {
		const modal = new Modal('medium');
		modal.header.classList.add('title');
		modal.header.textContent = 'Edit Entry';
		modal.wrapper.classList.add('entry-edit');
		// Buttons to add classes later
		const submitButton = DOM.create('button', {
			class: 'primary puffy',
			childs: [DOM.icon('save'), DOM.text('Save')],
			type: 'submit',
		});
		submitButton.setAttribute('form', 'entry-form');
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
		// Active Service on the Title
		const services = DOM.create('div', { class: 'services' });
		for (const sn in ActivableName) {
			const serviceName = sn as ActivableName;
			const serviceKey = ServiceKey[serviceName];
			services.appendChild(
				DOM.create('div', {
					class: 'service',
					childs: [
						DOM.create('img', { src: `/icons/${serviceKey}.png`, title: serviceName }),
						DOM.space(),
						...GetService(serviceName).SaveInput(title.services[serviceKey]!),
					],
				})
			);
		}
		// Create form with every rows
		const form = DOM.create('form', { class: 'save-entry', name: 'entry-form' });
		const realSubmit = DOM.create('button', {
			type: 'submit',
			css: { display: 'none' },
		});
		DOM.append(
			form,
			this.modalRow([
				this.modalGroup('MangaDex', '', [
					DOM.create('span', { class: 'helper', textContent: `# ${title.id}` }),
				]),
				this.modalGroup('Name', 'ee_name', [
					DOM.create('input', {
						id: 'ee_name',
						name: 'mediaName',
						type: 'text',
						placeholder: 'Name',
						value: title.name ? title.name : '',
					}),
				]),
			]),
			this.modalRow([
				this.modalGroup('Chapter', 'ee_chapter', [
					DOM.create('input', {
						id: 'ee_chapter',
						name: 'chapter',
						type: 'number',
						placeholder: 'Chapter',
						value: `${title.progress.chapter}`,
						required: true,
					}),
				]),
				this.modalGroup('Volume', 'ee_volume', [
					DOM.create('input', {
						id: 'ee_volume',
						name: 'volume',
						type: 'number',
						placeholder: 'Volume',
						value: title.progress.volume ? `${title.progress.volume}` : '',
					}),
				]),
			]),
			this.modalRow([
				this.modalGroup('Status', 'status', [this.statusOptions(title)]),
				this.modalGroup('Score (0-100)', 'ee_score', [
					DOM.create('input', {
						id: 'ee_score',
						name: 'score',
						type: 'number',
						placeholder: 'Score (0-100)',
						min: '0',
						max: '100',
						value: title.score > 0 ? `${title.score}` : '',
					}),
				]),
			]),
			this.modalRow([
				this.modalGroup('Start', 'ee_start', [
					DOM.create('input', {
						id: 'ee_start',
						name: 'start',
						type: 'date',
						placeholder: 'Start Date',
						value: title.start ? dateFormatInput(title.start) : '',
					}),
				]),
				this.modalGroup('End', 'ee_end', [
					DOM.create('input', {
						id: 'ee_end',
						name: 'end',
						type: 'date',
						placeholder: 'End Date',
						value: title.end ? dateFormatInput(title.end) : '',
					}),
				]),
			]),
			DOM.create('label', { textContent: 'Services' }),
			services,
			realSubmit
		);
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			modal.disableExit();
			cancelButton.disabled = true;
			submitButton.disabled = true;
			submitButton.classList.add('loading');
			// Chapter and Status always required
			const chapter = parseFloat(form.chapter.value);
			if (!isNaN(chapter) && chapter > -1) title.progress.chapter = chapter;
			else title.progress.chapter = 0;
			title.status = parseInt(form.status.value);
			// Volume
			if (form.volume.value != '') {
				const volume = parseInt(form.volume.value);
				if (!isNaN(volume) && volume > -1) title.progress.volume = volume;
			} else delete title.progress.volume;
			// Name
			if (form.mediaName.value != '') title.name = (form.mediaName.value as string).trim();
			else delete title.name;
			// Score
			if (form.score.value != '') {
				const score = parseInt(form.score.value);
				if (!isNaN(score) && score >= 0) title.score = score;
			} else title.score = 0;
			// Start - YYYY-MM-DD, convert month from 1-12 to 0-11
			if (form.start.value != '') {
				const parts: number[] = (form.start.value as string).split('-').map((p) => parseInt(p));
				title.start = new Date(parts[0], parts[1] - 1, parts[2]);
			} else delete title.start;
			// End - YYYY-MM-DD
			if (form.end.value != '') {
				const parts: number[] = (form.end.value as string).split('-').map((p) => parseInt(p));
				title.end = new Date(parts[0], parts[1] - 1, parts[2]);
			} else delete title.end;
			// Services
			for (const sn in ActivableName) {
				GetService(sn as ServiceName).HandleInput(title, form);
			}
			// Save and close Modal
			await title.persist();
			SimpleNotification.info({ title: 'Title Saved' }, { position: 'bottom-left' });
			submitButton.classList.remove('loading');
			modal.enableExit();
			modal.remove();
			this.loadPage(this.currentPage);
		});
		submitButton.addEventListener('click', (event) => {
			event.preventDefault();
			realSubmit.click();
		});
		modal.body.appendChild(form);
		DOM.append(modal.footer, submitButton, cancelButton);
		return modal;
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
			this.createModal(title).show();
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

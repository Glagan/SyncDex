import { Title, TitleCollection, ServiceKey, ActivableName, ServiceName, ReverseServiceName } from '../src/Title';
import { DOM, AppendableElement } from '../src/DOM';
import { LocalStorage } from '../src/Storage';
import { Modal } from './Modal';
import { GetService } from './Manager/Service';

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
		this.paging = document.getElementById('save-paging')!;
		this.pagingPages = document.getElementById('paging-pages')!;
		this.body = document.getElementById('save-body')!;
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

	titleServices = (title: Title): AppendableElement[] => {
		const icons: AppendableElement[] = [];
		for (const serviceKey in title.services) {
			const key = serviceKey as ServiceKey;
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

	zeroPad = (n: number): string => {
		return ('00' + n).slice(-2);
	};

	dateFormat = (timestamp: number): string => {
		const d = new Date(timestamp);
		return `${d.getFullYear()}-${this.zeroPad(d.getMonth() + 1)}-${this.zeroPad(d.getDate())}`;
		// `${this.zeroPad(d.getHours())}:${this.zeroPad(d.getMinutes())}:${this.zeroPad(d.getSeconds())}`;
	};

	statusOptions = (title: Title): HTMLSelectElement => {
		const select = DOM.create('select', { id: 'ee_status', name: 'status', required: true });
		let value = 0;
		for (const status of Object.values(SaveViewer.statusMap)) {
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
		modal.body.classList.add('entry-edit');
		// Buttons to add classes later
		const submitButton = DOM.create('button', {
			class: 'primary puffy',
			childs: [DOM.icon('save'), DOM.text('Save')],
		});
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
			const serviceName = sn as ServiceName;
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
		const form = DOM.create('form', { class: 'save-entry' });
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
						value: title.start ? this.dateFormat(title.start) : '',
					}),
				]),
				this.modalGroup('End', 'ee_end', [
					DOM.create('input', {
						id: 'ee_end',
						name: 'end',
						type: 'date',
						placeholder: 'End Date',
						value: title.end ? this.dateFormat(title.end) : '',
					}),
				]),
			]),
			DOM.create('label', { textContent: 'Services' }),
			services,
			DOM.create('div', {
				childs: [submitButton, cancelButton],
			})
		);
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			modal.disableExit();
			cancelButton.disabled = true;
			submitButton.disabled = true;
			submitButton.classList.add('loading');
			// Chapter and Status always required
			const chapter = parseFloat(form.chapter.value);
			if (!isNaN(chapter) && chapter >= -1) title.progress.chapter = chapter;
			title.status = parseInt(form.status.value);
			// Volume
			if (form.volume.value != '') {
				const volume = parseInt(form.volume.value);
				if (!isNaN(volume) && volume >= -1) title.progress.volume = volume;
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
				title.start = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
			} else delete title.start;
			// End - YYYY-MM-DD
			if (form.end.value != '') {
				const parts: number[] = (form.end.value as string).split('-').map((p) => parseInt(p));
				title.end = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
			} else delete title.end;
			// Services
			for (const sn in ActivableName) {
				GetService(sn as ServiceName).HandleInput(title, form);
			}
			// Save and close Modal
			await title.save();
			submitButton.classList.remove('loading');
			modal.enableExit();
			modal.remove();
			this.loadPage(this.currentPage);
		});
		modal.body.appendChild(form);
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

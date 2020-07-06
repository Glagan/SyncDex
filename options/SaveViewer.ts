import { Title, TitleCollection } from '../src/Title';
import { DOM, AppendableElement } from '../src/DOM';

export class SaveViewer {
	body: HTMLElement;
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
		this.body = document.getElementById('save-body') as HTMLElement;
		this.updateAll();
	}

	titleServices = (title: Title): AppendableElement[] => {
		const icons: AppendableElement[] = [];
		for (const serviceKey in title.services) {
			icons.push(
				DOM.create('a', {
					attributes: {
						target: '_blank',
						href: `#`,
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
		return `${d.getFullYear()}-${this.zeroPad(d.getMonth() + 1)}-${this.zeroPad(d.getDate())} ${this.zeroPad(
			d.getHours()
		)}:${this.zeroPad(d.getMinutes())}:${this.zeroPad(d.getSeconds())}`;
	};

	createRow = (title: Title): HTMLElement => {
		return DOM.create('tr', {
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
				DOM.create('td', { class: 'name', textContent: title.name ? title.name : '-' }),
				DOM.create('td', { childs: this.titleServices(title) }),
				DOM.create('td', { textContent: SaveViewer.statusMap[title.status] }),
				DOM.create('td', { textContent: title.score ? title.score.toString() : '-' }),
				DOM.create('td', { textContent: title.start ? this.dateFormat(title.start) : '-' }),
				DOM.create('td', { textContent: title.end ? this.dateFormat(title.end) : '-' }),
				DOM.create('td', {
					class: 'actions',
					childs: [DOM.create('button', { class: 'ghost', childs: [DOM.icon('trash')] })],
				}),
			],
		});
	};

	updateAll = async (): Promise<void> => {
		DOM.clear(this.body);
		const titles = await TitleCollection.get();
		const fragment = document.createDocumentFragment();
		for (const title of titles.collection) {
			fragment.appendChild(this.createRow(title));
		}
		this.body.appendChild(fragment);
	};
}

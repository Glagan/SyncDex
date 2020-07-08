import { Title, TitleCollection } from '../src/Title';
import { DOM, AppendableElement } from '../src/DOM';
import { LocalStorage } from '../src/Storage';
import { MyAnimeListTitle } from '../src/Service/MyAnimeList';
import { AnilistTitle } from '../src/Service/Anilist';
import { KitsuTitle } from '../src/Service/Kitsu';
import { AnimePlanetTitle } from '../src/Service/AnimePlanet';
import { MangaUpdatesTitle } from '../src/Service/MangaUpdates';

export class SaveViewer {
	body: HTMLElement;
	titles: TitleCollection = new TitleCollection();

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
		return `${d.getFullYear()}-${this.zeroPad(d.getMonth() + 1)}-${this.zeroPad(d.getDate())} ${this.zeroPad(
			d.getHours()
		)}:${this.zeroPad(d.getMinutes())}:${this.zeroPad(d.getSeconds())}`;
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
				DOM.create('td', { class: 'name', textContent: title.name ? title.name : '-' }),
				DOM.create('td', { childs: this.titleServices(title) }),
				DOM.create('td', { textContent: SaveViewer.statusMap[title.status] }),
				DOM.create('td', { textContent: title.score ? title.score.toString() : '-' }),
				DOM.create('td', { textContent: title.start ? this.dateFormat(title.start) : '-' }),
				DOM.create('td', { textContent: title.end ? this.dateFormat(title.end) : '-' }),
				DOM.create('td', {
					class: 'actions',
					childs: [editButton, deleteButton],
				}),
			],
		});
		editButton.addEventListener('click', async (event) => {});
		deleteButton.addEventListener('click', async (event) => {
			event.preventDefault();
			deleteButton.disabled = true;
			deleteButton.classList.add('loading');
			await LocalStorage.remove(title.id);
			row.remove();
		});
		return row;
	};

	updateAll = async (): Promise<void> => {
		DOM.clear(this.body);
		this.titles = await TitleCollection.get();
		const fragment = document.createDocumentFragment();
		let i = 0;
		for (const title of this.titles.collection) {
			fragment.appendChild(this.createRow(title));
			if (++i == 50) {
				// TODO: Load more
				break;
			}
		}
		this.body.appendChild(fragment);
	};
}

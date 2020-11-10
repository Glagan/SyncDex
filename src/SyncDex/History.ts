import { LocalStorage } from '../Core/Storage';
import { LocalTitle } from '../Core/Title';
import { DOM } from '../Core/DOM';
import { progressToString, dateFormat } from '../Core/Utility';

export class History {
	static last?: number;
	static page?: number;
	static ids: number[] = [];

	static find(id: number): number {
		return History.ids.indexOf(id);
	}

	static add(id: number) {
		const index = History.find(id);
		if (index > 0) {
			History.ids.splice(index, 1);
		}
		History.ids.unshift(id);
	}

	static async load(): Promise<void> {
		await (LocalStorage.get('history') as Promise<HistoryObject | undefined>).then(async (res) => {
			if (res == undefined) {
				await LocalStorage.set('history', { ids: [] });
			} else {
				History.last = res.last;
				History.page = res.page;
				History.ids = res.ids;
			}
		});
	}

	static async save(): Promise<void> {
		await LocalStorage.set('history', {
			last: History.last,
			page: History.page,
			ids: History.ids,
		});
	}

	static buildCard = (title: LocalTitle): HTMLElement => {
		return DOM.create('div', {
			class: 'large_logo rounded position-relative mx-1 my-2 has-transition',
			childs: [
				DOM.create('div', {
					class: 'hover',
					childs: [
						DOM.create('a', {
							href: `/title/${title.key.id}`,
							childs: [
								DOM.create('img', {
									class: 'rounded',
									title: title.name,
									src: `/images/manga/${title.key.id}.large.jpg`,
									css: { width: '100%' },
								}),
							],
						}),
					],
				}),
				DOM.create('div', {
					class: 'car-caption px-2 py-1',
					childs: [
						DOM.create('p', {
							class: 'text-truncate m-0',
							childs: [
								DOM.create('a', {
									class: 'manga_title white',
									title: title.name,
									href: `/title/${title.key.id}`,
									textContent: title.name,
								}),
							],
						}),
						DOM.create('p', {
							class: 'text-truncate m-0',
							childs: [
								DOM.create('a', {
									class: 'white',
									href: `/chapter/${title.lastChapter}`,
									textContent: progressToString(title.progress),
								}),
							],
						}),
					],
				}),
			],
		});
	};

	static updateCard(card: HTMLElement, title: LocalTitle) {
		card.dataset.toggle = 'tooltip';
		card.dataset.placement = 'bottom';
		card.dataset.html = 'true';
		const content = [];
		if (title.lastTitle) {
			content.push('Last visit', dateFormat(new Date(title.lastTitle), true));
		}
		if (title.lastRead) {
			content.push(
				'Last read',
				`<span style='color:rgb(51,152,182)'>${dateFormat(new Date(title.lastRead), true)}</span>`
			);
		}
		card.title = content.join('<br>');
	}

	static highlight(card: HTMLElement, title: LocalTitle) {
		if (title.highest) {
			if (title.highest <= title.progress.chapter) {
				card.classList.add('history-up');
			} else if (title.highest > title.progress.chapter) {
				card.classList.add('history-down');
			}
		}
	}
}

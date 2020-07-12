import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './MangaDex';
import { DOM } from './DOM';
import { TitleCollection, Title } from './Title';
import { Overview } from './Overview';

console.log('SyncDex :: Core');

export class SyncDex {
	router: Router = new Router();

	constructor() {
		this.router.register(
			[
				'/follows/?$',
				'/follows/chapters(/?$|/\\d+(/\\d+/?)?)?',
				'/group/\\d+(/[-A-Za-z0-9_]{0,}/?)?$',
				'/group/\\d+/[-A-Za-z0-9_]{0,}/chapters(/?|/\\d+/?)$',
				'/user/\\d+(/[-A-Za-z0-9_]{0,}/?)?$',
				'/user/\\d+/[-A-Za-z0-9_]{0,}/chapters(/?|/\\d+/?)$',
			],
			this.chapterList
		);
		this.router.register('/chapter/\\d+$', this.chapterPage);
		this.router.register(
			[
				'/follows/manga(/?|/\\d(/?|/\\d+(/?|/\\d+/?)))$',
				'/group/\\d+/[-A-Za-z0-9_]{0,}/manga(/?|/\\d+/?)$',
				'/user/\\d+/[-A-Za-z0-9_]{0,}/manga(/?|/\\d+/?)$',
				'(/search|\\?page=search)',
				'(/titles|\\?page=titles)',
				'/genre(/\\d+)?$',
				'/featured$',
			],
			this.titleList
		);
		this.router.register('/(manga|title)(/?|/\\d+(/?|/[-A-Za-z0-9_]{0,}/?))$', this.titlePage);
		this.router.register('/updates(/?$|/\\d+/?)$', this.updatesPage);
	}

	execute = (location: string): void => {
		const fnct = this.router.match(location);
		if (fnct) fnct();
	};

	chapterList = async (): Promise<any> => {
		console.log('SyncDex :: Chapter List');

		if (!Options.hideHigher && !Options.hideLast && !Options.hideLower && !Options.thumbnail && !Options.highlight)
			return;
		const md = new MangaDex(document);
		const groups = md.getChaptersGroups();
		const container = Options.thumbnail
			? (() => {
					const container = DOM.create('div', {
						id: 'tooltip-container',
					});
					document.body.appendChild(container);
					return container;
			  })()
			: undefined;
		const titles = await TitleCollection.get(
			groups.map((group) => {
				return group.titleId;
			})
		);
		// Hide, Highlight and add Thumbnails to each row
		for (const group of groups) {
			const title = titles.find(group.titleId);
			if (title !== undefined && !title.new) {
				group.hide(title.progress);
				group.highlight(title.progress);
			}
			if (Options.thumbnail && container) {
				group.setThumbnail(container);
			}
		}
		// Button to toggle hidden chapters
		const rows = document.querySelectorAll('.hidden');
		const hiddenCount = rows.length;
		const navBar = document.querySelector<HTMLElement>('ul.nav.nav-tabs');
		if (navBar && hiddenCount > 0) {
			const icon = DOM.icon('eye');
			const linkContent = DOM.create('span', { textContent: `Show Hidden ${hiddenCount}` });
			const link = DOM.create('a', {
				class: 'nav-link',
				href: '#',
				childs: [icon, DOM.space(), linkContent],
			});
			let active = false;
			link.addEventListener('click', (event) => {
				event.preventDefault();
				rows.forEach((row) => {
					row.classList.toggle('visible');
				});
				icon.classList.toggle('fa-eye');
				icon.classList.toggle('fa-eye-slash');
				if (active) linkContent.textContent = `Show Hidden ${hiddenCount}`;
				else linkContent.textContent = `Hide Hidden ${hiddenCount}`;
				active = !active;
			});
			const button = DOM.create('li', { class: 'nav-item', childs: [link] });
			if (navBar.lastElementChild!.classList.contains('ml-auto')) {
				navBar.insertBefore(button, navBar.lastElementChild);
			} else {
				navBar.appendChild(button);
			}
		}
	};

	chapterPage = (): void => {
		console.log('SyncDex :: Chapter');
	};

	titleList = (): void => {
		console.log('SyncDex :: Title List');
	};

	titlePage = async (): Promise<void> => {
		console.log('SyncDex :: Title');

		// Get Title
		const id = parseInt(document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!);
		const title = await Title.get(id);
		console.log(title);
		// Search for the progress row and add overview there
		if (Options.showOverview) {
			const row = document.querySelector<HTMLElement>('.reading_progress')!.parentElement!;
			const overview = new Overview(title);
			row.parentElement!.insertBefore(overview.row, row);
		}
	};

	updatesPage = (): void => {
		console.log('SyncDex :: Updates');
	};
}

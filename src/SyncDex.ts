import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './MangaDex';
import { DOM } from './DOM';
import { TitleCollection } from './Title';

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
	};

	chapterPage = (): void => {};
	titleList = (): void => {};
	titlePage = (): void => {};
	updatesPage = (): void => {};
}

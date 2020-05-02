import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './MangaDex';
import { DOM } from './DOM';
import { TitleCollection } from './Title';

console.log('SyncDex :: SyncDex');

export class SyncDex {
	router: Router = new Router();

	constructor() {
		this.router.register(
			[
				'/follows(/chapters)?$',
				'/group/(\\d+)(/chapters)?$',
				'/user/(\\d+)(/chapters)?$',
				'/follows(/manga)?$',
				'/group/(\\d+)(/manga)?$',
				'/user/(\\d+)(/manga)?$',
			],
			this.chapterList
		);
		this.router.register('/chapter', this.chapterPage);
		this.router.register(
			['/genre', '/featured', '(/search|\\?page=search)', '(/titles|\\?page=titles)'],
			this.titleList
		);
		this.router.register('/(manga|title)', this.titlePage);
		this.router.register('/updates', this.updatesPage);
	}

	execute = (location: string): void => {
		const fnct = this.router.match(location);
		if (fnct) {
			fnct();
		}
	};

	chapterList = async (): Promise<any> => {
		console.log('SyncDex :: Chapter List');

		if (
			!Options.hideHigher &&
			!Options.hideLast &&
			!Options.hideLower &&
			!Options.thumbnail &&
			!Options.updateServicesInList &&
			!Options.highlight
		)
			return;
		const md = new MangaDex(document);
		const groups = md.getChaptersGroups();
		const container = Options.thumbnail
			? (() => {
					const container = DOM.create('div', {
						attributes: {
							id: 'tooltip-container',
						},
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

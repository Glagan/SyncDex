import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './MangaDex';
import { LocalStorage } from './Storage';
import { DOM } from './DOM';
import { Title } from './interfaces';

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
		const titles: { [key: number]: Title | undefined | null } = {};
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
		for (let index = 0; index < groups.length; index++) {
			const group = groups[index];
			let title = titles[group.titleId];
			if (title === undefined) {
				title = await LocalStorage.get<Title>(group.titleId);
				if (title === undefined) {
					title = null;
				}
				titles[group.titleId] = title;
			}
			console.log(title);
			if (title !== null) {
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

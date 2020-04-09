import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './MangaDex';
import { LocalStorage } from './Storage';
import { DOM } from './DOM';
import { Title } from './interfaces';

console.log('SyncDex :: SyncDex');

export class SyncDex {
	router: Router = new Router();
	options: Options = new Options();

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
		this.options.load();
		console.log(this.options);

		// DEBUG
		// LocalStorage.set(20723, {
		// 	progress: {
		// 		chapter: 36,
		// 		volume: 7
		// 	}
		// });
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
			!this.options.hideHigher &&
			!this.options.hideLast &&
			!this.options.hideLower &&
			!this.options.thumbnail &&
			!this.options.updateServicesInList &&
			!this.options.highlight
		)
			return;
		const md = new MangaDex(this.options, document);
		const groups = md.getChaptersGroups();
		const titles: { [key: number]: Title | undefined | null } = {};
		const container = this.options.thumbnail
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
				group.hide(this.options, title.progress);
				group.highlight(this.options, title.progress);
			}
			if (this.options.thumbnail && container) {
				group.setThumbnail(
					container,
					this.options.originalThumbnail,
					this.options.thumbnailMaxHeight
				);
			}
		}
	};

	chapterPage = (): void => {};
	titleList = (): void => {};
	titlePage = (): void => {};
	updatesPage = (): void => {};
}

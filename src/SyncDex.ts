import { Router } from './Router';
import { Options } from './Options';

console.log('SyncDex :: SyncDex');

class SyncDex {
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
				'/user/(\\d+)(/manga)?$'
			],
			this.chapterList
		);
		this.router.register('/chapter', this.chapterPage);
		this.router.register(
			[
				'/genre',
				'/featured',
				'(/search|\\?page=search)',
				'(/titles|\\?page=titles)'
			],
			this.titleList
		);
		this.router.register('/(manga|title)', this.titlePage);
		this.router.register('/updates', this.updatesPage);
		this.options.load();
	}

	execute(location: string): void {
		const fnct = this.router.match(location);
		if (fnct) {
			fnct();
		}
		console.log(location, 'found', fnct);
		console.log(this.options);
	}

	chapterList(): void {}
	chapterPage(): void {}
	titleList(): void {}
	titlePage(): void {}
	updatesPage(): void {}
}

export { SyncDex };

import { Router } from './Router';

class SyncDex {
	router: Router = new Router();

	constructor() {
		this.router.register('/follows(/chapters)?$', this.chapterList);
		this.router.register('/group/(\\d+)(/chapters)?$', this.chapterList);
		this.router.register('/user/(\\d+)(/chapters)?$', this.chapterList);
		this.router.register('/chapter', this.chapterPage);
		this.router.register('/follows(/manga)?$', this.chapterList);
		this.router.register('/group/(\\d+)(/manga)?$', this.chapterList);
		this.router.register('/user/(\\d+)(/manga)?$', this.chapterList);
		this.router.register('/genre', this.titleList);
		this.router.register('/featured', this.titleList);
		this.router.register('(/search|\\?page=search)', this.titleList);
		this.router.register('(/titles|\\?page=titles)', this.titleList);
		this.router.register('/(manga|title)', this.titlePage);
		this.router.register('/updates', this.updatesPage);
	}

	execute(location: string): void {
		const fnct = this.router.match(location);
		if (fnct) {
			fnct();
		}

		// Test
		const tests = [
			'/follows',
			'/titles',
			'?page=titles',
			'/search',
			'?page=search',
			'/featured',
			'/manga',
			'/title',
			'/title/Super-Long-Title',
			'/updates',
			'/user/105544',
			'/user/105544/manga',
			'/user/105544/chapters',
			'/group/105544',
			'/group/105544/manga',
			'/group/105544/chapters',
			'/chapter',
			'/chapter/1025'
		];
		for (let index = 0; index < tests.length; index++) {
			const test = tests[index];
			console.log(test, this.router.match(test));
		}
	}

	chapterList(): void {}
	chapterPage(): void {}
	titleList(): void {}
	titlePage(): void {}
	updatesPage(): void {}
}

export { SyncDex };

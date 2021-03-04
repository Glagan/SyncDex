import { Options } from '../Core/Options';
import { SaveSync } from '../Core/SaveSync';
import { Storage } from '../Core/Storage';
import { Page } from './Page';
import { ChapterListPage } from './Page/ChapterList';
import { TitleListPage } from './Page/TitleList';
import { TitlePage } from './Page/Title';
import { UpdatesPage } from './Page/Updates';
import { HistoryPage } from './Page/History';
import { ChapterPage } from './Page/Chapter';
import { History } from '../Core/History';
import { UpdateQueue } from '../Core/UpdateQueue';

const start = Date.now();
console.log('SyncDex :: Index');

(async () => {
	SimpleNotification._options.position = 'bottom-left';
	// Check if SyncDex reloaded and abort
	if (document.body.classList.contains('sc-loaded')) {
		SimpleNotification.info(
			{
				text: 'SyncDex reloaded',
				buttons: [
					{ value: 'Reload', type: 'success', onClick: () => window.location.reload() },
					{ value: 'Close', type: 'message', onClick: (n) => n.closeAnimated() },
				],
			},
			{ sticky: true }
		);
		return;
	}
	document.body.classList.add('sc-loaded');
	UpdateQueue.register();

	// Load
	await Options.load();
	if (Options.biggerHistory) {
		await History.load();
	}
	SaveSync.state = await Storage.get('saveSync');

	// Define routes
	const routes: { location: string[]; page: typeof Page }[] = [
		{
			page: ChapterListPage,
			location: [
				'/follows/?$',
				'/follows/chapters(/?$|/\\d+(/\\d+/?)?)?',
				'/group/\\d+(/[-A-Za-z0-9_]{0,}/?)?$',
				'/group/\\d+/[-A-Za-z0-9_]{0,}/chapters(/?|/\\d+/?)$',
				'/user/\\d+(/[-A-Za-z0-9_]{0,}/?)?$',
				'/user/\\d+/[-A-Za-z0-9_]{0,}/chapters(/?|/\\d+/?)$',
			],
		},
		{
			page: ChapterPage,
			location: ['/chapter/\\d+(/\\d+)?(/gap)?$'],
		},
		{
			page: TitleListPage,
			location: [
				'/follows/manga(/?|/\\d(/?|/\\d+(/?|/\\d+/?)))$',
				'/group/\\d+/[-A-Za-z0-9_]{0,}/manga(/?|/\\d+/?)$',
				'/user/\\d+/[-A-Za-z0-9_]{0,}/manga(/?|/\\d+/?)$',
				'/(search|\\?page=search.*)',
				'/(titles|\\?page=titles.*)',
				'/genre(/\\d+)?$',
				'/featured$',
			],
		},
		{
			page: TitlePage,
			location: ['/(manga|title)(/?|/\\d+(/?|/[-A-Za-z0-9_]{0,}(/?|/chapters(/?|/\\d+/?))))$'],
		},
		{
			page: UpdatesPage,
			location: ['/updates(/?$|/\\d+/?)$'],
		},
		{
			page: HistoryPage,
			location: ['/history$'],
		},
	];

	// Match route
	const location = `${window.location.pathname}${window.location.search}`;
	for (const route of routes) {
		for (const routeLocation of route.location) {
			if (location.match(routeLocation)) {
				/// @ts-ignore
				const page = new route.page();
				await page.run();
				console.log(`SyncDex :: Initial Load in ${Date.now() - start}ms`);
				return;
			}
		}
	}
})();

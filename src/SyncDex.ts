import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './MangaDex';
import { DOM } from './DOM';
import {
	TitleCollection,
	Title,
	ServiceKeyType,
	ReverseActivableName,
	ActivableKey,
	ServiceTitleList,
	LocalTitle,
} from './Title';
import { Overview } from './Overview';
import { Mochi } from './Mochi';
import { GetService } from './Service';
import { RequestStatus } from './Runtime';

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
			if (title !== undefined && !title.inList) {
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

	syncServices = async (
		title: Title,
		services: ServiceTitleList,
		overview?: Overview,
		auto: boolean = false
	): Promise<void> => {
		for (const serviceKey of Options.services) {
			if (services[serviceKey] === undefined) continue;
			const response: Title | RequestStatus = await services[serviceKey]!;
			if (response instanceof Title && response.loggedIn) {
				response.isSynced(title);
				// If Auto Sync is on, import from now up to date Title and persist
				if ((!auto || Options.autoSync) && (!response.inList || !response.synced)) {
					if (overview) overview.isSyncing(serviceKey);
					response.import(title);
					response.persist().then((res) => {
						if (overview) {
							if (res > RequestStatus.CREATED) overview.updateOverview(serviceKey, res);
							else overview.updateOverview(serviceKey, response);
						}
					});
					// Always update the overview to check against possible imported ServiceTitle
				} else if (overview) overview.updateOverview(serviceKey, response);
			}
		}
	};

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	checkServiceStatus = async (title: Title, services: ServiceTitleList, overview: Overview): Promise<void> => {
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		let externalImported = false;
		for (const serviceKey of Options.services.reverse()) {
			if (services[serviceKey] === undefined) continue;
			const response: Title | RequestStatus = await services[serviceKey]!;
			if (response instanceof Title && response.loggedIn) {
				// Check if any of the ServiceTitle is more recent than the local Title
				if (response.inList && (title.inList || response.isMoreRecent(title))) {
					// If there is one, sync with it and save
					title.inList = false;
					title.merge(response);
					externalImported = true;
				}
			}
		}
		if (externalImported) await title.persist();
		// When the Title is synced, all remaining ServiceTitle are synced with it
		if (title.status == Status.NONE) {
			overview.addQuickButtons();
		} else this.syncServices(title, services, overview, true);
	};

	titlePage = async (): Promise<void> => {
		console.log('SyncDex :: Title');

		if (!Options.linkToServices && !Options.saveOpenedChapters) return;
		// Get Title
		const id = parseInt(document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!);
		const title = await LocalTitle.get(id);
		title.lastTitle = Date.now();
		// Name
		if (title.inList || title.name === undefined || title.name == '') {
			const headerTitle = document.querySelector('h6.card-header');
			if (headerTitle) title.name = headerTitle.textContent!.trim();
		}
		// Highlight read chapters and next chapter
		if (Options.saveOpenedChapters) {
			const rows = document.querySelectorAll<HTMLElement>('.chapter-row');
			for (const row of rows) {
				const chapter = parseInt(row.dataset.chapter!);
				if (!isNaN(chapter)) {
					if (chapter > title.progress.chapter && chapter < Math.floor(title.progress.chapter) + 2) {
						row.classList.add('has-transition');
						row.style.backgroundColor = Options.colors.nextChapter;
					} else if (title.chapters.indexOf(chapter) >= 0) {
						row.classList.add('has-transition');
						row.style.backgroundColor = Options.colors.openedChapter;
					}
				}
			}
		}
		// Always Find Services
		let fallback = false;
		if (Options.useMochi) {
			const connections = await Mochi.find(id);
			if (connections !== undefined) {
				Mochi.assign(title, connections);
			} else fallback = true;
		}
		// If Mochi failed or if it's disabled use displayed Services
		if (!Options.useMochi || fallback) {
			const informationTable = document.querySelector('.col-xl-9.col-lg-8.col-md-7');
			if (informationTable) {
				// Look for the "Information:" column
				const informationRow = Array.from(informationTable.children).find(
					(row) => row.firstElementChild!.textContent == 'Information:'
				);
				if (informationRow) {
					const services = informationRow.querySelectorAll<HTMLImageElement>('img');
					for (const serviceIcon of services) {
						const serviceLink = serviceIcon.nextElementSibling as HTMLAnchorElement;
						// Convert icon name to ServiceKey, only since kt is ku
						const serviceKey = MangaDex.iconToService(serviceIcon.src);
						if (serviceKey !== undefined) {
							(title.services[serviceKey] as ServiceKeyType) = GetService(
								ReverseActivableName[serviceKey]
							).idFromLink(serviceLink.href);
						}
					}
				} // Nothing to do if there is no row
			}
		}
		await title.persist(); // Always save
		// Load each Services to Sync
		const services: ServiceTitleList = {};
		if (Options.services.length > 0) {
			let activeServices = Object.keys(title.services).filter(
				(key) => Options.services.indexOf(key as ActivableKey) >= 0
			);
			// Add Services ordered by Options.services to check Main Service first
			for (const service of Options.services) {
				if (activeServices.indexOf(service) >= 0) {
					services[service] = GetService(ReverseActivableName[service]).get(title.services[service]!);
				}
			}
		}
		// Search for the progress row and add overview there
		let overview = new Overview(title, services, this);
		overview.displayServices();
		// Sync Services
		this.checkServiceStatus(title, services, overview);
	};

	updatesPage = (): void => {
		console.log('SyncDex :: Updates');
	};
}

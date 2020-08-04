import { Router } from './Router';
import { Options } from './Options';
import { MangaDex } from './ChapterGroup';
import { DOM } from './DOM';
import {
	TitleCollection,
	BaseTitle,
	ServiceKeyType,
	ReverseActivableName,
	ActivableKey,
	ExternalTitleList,
	Title,
	StatusMap,
	ExternalTitle,
	ReverseServiceName,
	ServiceKey,
	StaticKey,
} from './Title';
import { Overview } from './Overview';
import { Mochi } from './Mochi';
import { GetService } from './Service';
import { injectScript } from './Utility';
import { Runtime } from './Runtime';
import { Thumbnail } from './Thumbnail';

interface ReadingState {
	title?: Title;
	services: ExternalTitleList;
	overview?: HTMLElement;
	icons: { [key in ActivableKey]?: HTMLElement };
}

export interface SyncEvents {
	beforePersist?: (key: ActivableKey) => void;
	afterPersist?: (key: ActivableKey, response: RequestStatus) => Promise<void>;
	alreadySynced?: (key: ActivableKey) => Promise<void>;
}

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
		this.router.register('/chapter/\\d+(/\\d+)?$', this.chapterPage);
		this.router.register(
			[
				'/follows/manga(/?|/\\d(/?|/\\d+(/?|/\\d+/?)))$',
				'/group/\\d+/[-A-Za-z0-9_]{0,}/manga(/?|/\\d+/?)$',
				'/user/\\d+/[-A-Za-z0-9_]{0,}/manga(/?|/\\d+/?)$',
				'/(search|\\?page=search.*)',
				'/(titles|\\?page=titles.*)',
				'/genre(/\\d+)?$',
				'/featured$',
			],
			this.titleList
		);
		this.router.register(
			'/(manga|title)(/?|/\\d+(/?|/[-A-Za-z0-9_]{0,}(/?|/chapters(/?|/\\d+/?))))$',
			this.titlePage
		);
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
		const groups = md.getChapterGroups();
		const titles = await TitleCollection.get(
			groups.map((group) => {
				return group.id;
			})
		);
		// Hide, Highlight and add Thumbnails to each row
		for (const group of groups) {
			const title = titles.find(group.id);
			if (title !== undefined && !title.inList) {
				group.hide(title.progress);
				group.highlight(title.progress);
			}
			if (Options.thumbnail) group.setThumbnails();
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
				if (active) linkContent.textContent = `Show Hidden (${hiddenCount})`;
				else linkContent.textContent = `Hide Hidden (${hiddenCount})`;
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

	syncShowResult = async (state: ReadingState, created: boolean, init: boolean): Promise<void> => {
		if (state.title == undefined) return;
		const result = await this.syncServices(state.title, state.services, {
			beforePersist: (key) => {
				state.icons[key]?.classList.add('loading');
			},
			afterPersist: async (key, response) => {
				state.icons[key]?.classList.remove('loading');
				if (response > RequestStatus.CREATED) {
					state.icons[key]?.classList.add('error');
				} else state.icons[key]?.classList.add('synced');
			},
			alreadySynced: async (key) => {
				state.icons[key]?.classList.remove('loading');
				state.icons[key]?.classList.add('synced');
			},
		});
		/**
		 * Display result notification, one line per Service
		 * {Icon} Name [Created] / [Synced] / [Imported]
		 * Display another notification for errors, with the same template
		 * {Icon} Name [Not Logged In] / [Bad Request] / [Server Error]
		 */
		const makeRow = (key: ServiceKey, status: string) =>
			`![${ReverseServiceName[key]}|${Runtime.file(`/icons/${key}.png`)}] **${
				ReverseServiceName[key]
			}**>*>[${status}]<`;
		const updateRows: string[] = [];
		const errorRows: string[] = [];
		for (const key of Options.services) {
			if (result[key] === undefined) continue;
			if (state.title.services[key] === undefined) {
				updateRows.push(makeRow(key, 'No ID'));
			} else if (result[key] === false) {
				errorRows.push(makeRow(key, 'Logged Out'));
			} else if (result[key]! <= RequestStatus.CREATED) {
				updateRows.push(makeRow(key, result[key] === RequestStatus.CREATED ? 'Created' : 'Synced'));
			} else {
				errorRows.push(
					makeRow(key, result[key] === RequestStatus.SERVER_ERROR ? 'Server Error' : 'Bad Request')
				);
			}
		}
		// Display Notifications
		if (updateRows.length > 0) {
			SimpleNotification.success(
				{
					title: 'Progress Updated',
					image: `https://mangadex.org/images/manga/${state.title.id}.thumb.jpg`,
					text: `Chapter ${Math.floor(state.title.progress.chapter)}\n${
						created ? '**Start Date** set to Today !\n' : ''
					}${updateRows.join('\n')}`,
				},
				{ position: 'bottom-left', sticky: true }
			);
		} else if (!init) {
			SimpleNotification.success(
				{
					title: 'Progress Updated',
					text: `Chapter ${Math.floor(state.title.progress.chapter)}\n${
						created ? '**Start Date** set to Today !\n' : ''
					}${makeRow(StaticKey.SyncDex, 'Synced')}`,
				},
				{ position: 'bottom-left', sticky: true }
			);
		}
		if (errorRows.length > 0) {
			SimpleNotification.error(
				{
					title: 'Error',
					image: `https://mangadex.org/images/manga/${state.title.id}.thumb.jpg`,
					text: errorRows.join('\n'),
				},
				{ position: 'bottom-left', sticky: true }
			);
		}
	};

	setStateProgress = async (
		state: ReadingState,
		progress: Progress,
		created: boolean,
		chapter: number
	): Promise<void> => {
		if (!state.title) return;
		state.title.status = Status.READING;
		state.title.progress = progress;
		if (created) state.title.start = new Date();
		if (Options.biggerHistory) {
			state.title.lastChapter = chapter;
			state.title.lastRead = Date.now();
		}
		await state.title.persist();
	};

	chapterEvent = async (details: ChapterChangeEventDetails, state: ReadingState): Promise<void> => {
		console.log(details);
		// Get the Title and Services initial state on the first chapter change
		const id = details.manga._data.id;
		let init = false;
		if (state.title == undefined) {
			state.title = await Title.get(id);
			state.title.name = details.manga._data.title;
			init = true;
			// Find Services
			let fallback = false;
			if (Options.useMochi) {
				const connections = await Mochi.find(id);
				if (connections !== undefined) {
					Mochi.assign(state.title, connections);
				} else fallback = true;
			}
			if (!Options.useMochi || fallback) {
				const services = details.manga._data.links;
				for (const key in services) {
					const serviceKey = MangaDex.iconToService(key);
					if (serviceKey !== undefined) {
						(state.title.services[serviceKey] as ServiceKeyType) = GetService(
							ReverseActivableName[serviceKey]
						).idFromString(services[key as MangaDexExternalKeys]);
					}
				}
			}
			// Overview
			state.overview = DOM.create('div', { class: 'col row no-gutters reading-overview' });
			const overviewParent = DOM.create('div', {
				class: 'col-auto row no-gutters p-1',
				childs: [state.overview],
			});
			const actionsRow = document.querySelector('.reader-controls-mode')!;
			actionsRow.parentElement!.insertBefore(overviewParent, actionsRow);
			// Overview Icons
			for (const key of Options.services) {
				state.icons[key] = DOM.create('img', {
					src: Runtime.file(`/icons/${key}.png`),
					title: ReverseServiceName[key],
				});
				state.overview.appendChild(state.icons[key]!);
			}
			this.setServices(state.title, state.services, {
				beforeRequest: (key) => {
					state.icons[key]?.classList.add('loading');
				},
			}); // Send initial requests
		}
		// Check initial Status if it's the first time
		if (init) await this.checkServiceStatus(state.title, state.services);
		const created = state.title.status == Status.NONE || state.title.status == Status.PLAN_TO_READ;
		// Update title state if not delayed
		const delayed = details._data.status != 'OK' && details._data.status != 'external';
		let doUpdate = false;
		if (!delayed) {
			const currentProgress: Progress = { chapter: parseFloat(details._data.chapter) };
			if (details._data.volume !== '') currentProgress.volume = parseInt(details._data.volume);
			// Check if currentProgress should be updated
			// TODO: Check if saveOnlyNext works with new Titles, and a chapter 0 or 1
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && state.title.isNextChapter(currentProgress)) ||
				(Options.saveOnlyHigher && state.title.progress.chapter < currentProgress.chapter)
			) {
				await this.setStateProgress(state, currentProgress, created, details._data.id);
				doUpdate = true;
			} else if (Options.saveOnlyNext || Options.saveOnlyHigher) {
				SimpleNotification.info(
					{
						title: 'Chapter Not Higher',
						image: `https://mangadex.org/images/manga/${id}.thumb.jpg`,
						text: `**${state.title.name}** Chapter **${details._data.chapter}** is not the next or higher and hasn't been updated.`,
						buttons: [
							{
								type: 'success',
								value: 'Update',
								onClick: async (notification: SimpleNotification) => {
									await this.setStateProgress(state, currentProgress, created, details._data.id);
									this.syncShowResult(state, created, false);
									notification.closeAnimated();
								},
							},
							{
								type: 'message',
								value: 'Close',
							},
						],
					},
					{ position: 'bottom-left', sticky: true }
				);
			}
		} else {
			SimpleNotification.warning(
				{
					title: 'Title Delayed',
					image: `https://mangadex.org/images/manga/${id}.thumb.jpg`,
					text: `**${state.title.name}** Chapter **${details._data.chapter}** is delayed and has not been updated.`,
				},
				{ position: 'bottom-left', sticky: true }
			);
		}
		await state.title.persist(); // Always save
		// Always Sync Services -- even if doUpdate is set to false, to sync any out of sync services
		if (init || doUpdate) this.syncShowResult(state, created, init);
	};

	chapterPage = (): void => {
		console.log('SyncDex :: Chapter');

		if (Options.services.length == 0) {
			SimpleNotification.error({
				title: 'No active Services',
				text: `You have no **active Services**  !\nEnable one in the **Options** and refresh this page.\nAll Progress is still saved locally.`,
				buttons: [
					{
						type: 'info',
						value: 'Options',
						onClick: (notification: SimpleNotification) => {
							Runtime.openOptions();
							notification.closeAnimated();
						},
					},
				],
			});
		}

		// No support for Legacy Reader
		if (!document.querySelector('.reader-controls-container')) return;

		// Inject script to listen to Reader *chapterchange* event
		injectScript(function () {
			// *window* is in the MangaDex page context
			const addEventInterceptor = () =>
				window.reader!.model.on('chapterchange', (event) => {
					document.dispatchEvent(
						new CustomEvent('ReaderChapterChange', {
							detail: event,
						})
					);
				});
			// If the MangaDex reader still hasn't been loaded, check every 50ms
			if (window.reader === undefined) {
				const i = setInterval(() => {
					if (window.reader !== undefined) {
						clearInterval(i);
						addEventInterceptor();
					}
				}, 50);
			} else addEventInterceptor();
		});

		// Listen to injected Reader event
		const state: ReadingState = {
			title: undefined,
			services: {},
			icons: {},
		};
		document.addEventListener('ReaderChapterChange', async (event) => {
			await this.chapterEvent((event as ChapterChangeEvent).detail, state);
		});
	};

	titleList = async (): Promise<void> => {
		console.log('SyncDex :: Title List');

		const listTypeSelector = document.querySelector('.dropdown-item.title_mode.active');
		const listType: ListType = listTypeSelector ? parseInt(listTypeSelector.id) : ListType.Simple;
		const rows = document.querySelectorAll<HTMLElement>('.manga-entry');
		const titles = await TitleCollection.get(Array.from(rows).map((row) => parseInt(row.dataset.id!)));
		for (const row of rows) {
			const id = parseInt(row.dataset.id!);
			const title = titles.find(id);
			if (title && title.inList && title.status !== Status.NONE) {
				const status = DOM.create('span', {
					class: `st${title.status}`,
					textContent: StatusMap[title.status],
				});
				if (listType == ListType.Grid) {
					const bottomRow = row.querySelector('.float-right');
					if (bottomRow) {
						bottomRow.classList.add('has-status');
						bottomRow.insertBefore(status, bottomRow.firstElementChild);
					}
				} else {
					const nameCol = row.querySelector('.manga_title');
					if (nameCol) {
						status.classList.add('right');
						nameCol.parentElement!.classList.add('has-status');
						nameCol.parentElement!.appendChild(status);
					}
				}
			}
			// Do not display thumbnails in Grid and Detailed lists
			if (Options.thumbnail && listType != ListType.Grid && listType != ListType.Detailed) new Thumbnail(id, row);
		}
	};

	setServices = (
		title: Title,
		services: ExternalTitleList,
		events: { beforeRequest?: (key: ActivableKey) => void } = {}
	): void => {
		const activeServices = Object.keys(title.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		// Add Services ordered by Options.services to check Main Service first
		for (const key of Options.services) {
			if (activeServices.indexOf(key) >= 0) {
				if (events.beforeRequest) events.beforeRequest(key);
				services[key] = GetService(ReverseActivableName[key]).get(title.services[key]!);
			}
		}
	};

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	checkServiceStatus = async (title: Title, services: ExternalTitleList): Promise<void> => {
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		let doSave = false;
		await Promise.all(Object.values(services));
		for (const key of Options.services.reverse()) {
			if (services[key] === undefined) continue;
			const response = await services[key];
			if (response instanceof BaseTitle && response.loggedIn) {
				// Check if any of the ServiceTitle is more recent than the local Title
				if (response.inList && (title.inList || response.isMoreRecent(title))) {
					// If there is one, sync with it and save
					title.inList = false;
					title.merge(response);
					doSave = true;
				}
				// Finish retrieving the ID if required -- AnimePlanet has 2 fields
				if ((<typeof ExternalTitle>response.constructor).requireIdQuery) {
					(title.services[
						(<typeof ExternalTitle>response.constructor).serviceKey
					] as ServiceKeyType) = response.id;
					doSave = true;
				}
			}
		}
		if (doSave) await title.persist();
	};

	syncServices = async (
		title: Title,
		services: ExternalTitleList,
		events: SyncEvents = {},
		checkAutoSyncOption: boolean = false
	): Promise<{ [key in ActivableKey]?: RequestStatus | false }> => {
		const report: { [key in ActivableKey]?: RequestStatus | false } = {};
		const responses: Promise<void>[] = [];
		for (const serviceKey of Options.services) {
			if (services[serviceKey] === undefined) continue;
			responses.push(
				services[serviceKey]!.then(async (response) => {
					if (response instanceof BaseTitle) {
						if (!response.loggedIn) report[serviceKey] = false;
						response.isSynced(title);
						// If Auto Sync is on, import from now up to date Title and persist
						if ((!checkAutoSyncOption || Options.autoSync) && (!response.inList || !response.synced)) {
							if (events.beforePersist) events.beforePersist(serviceKey);
							response.import(title);
							const res = await response.persist();
							if (events.afterPersist) await events.afterPersist(serviceKey, res);
							report[serviceKey] = res;
							// Always update the overview to check against possible imported ServiceTitle
						} else if (events.alreadySynced) await events.alreadySynced(serviceKey);
					} else report[serviceKey] = response;
				})
			);
		}
		await Promise.all(responses);
		return report;
	};

	titlePage = async (): Promise<void> => {
		console.log('SyncDex :: Title');

		if (!Options.linkToServices && !Options.saveOpenedChapters) return;
		// Get Title
		const id = parseInt(document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!);
		const title = await Title.get(id);
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
		const services: ExternalTitleList = {};
		if (Options.services.length > 0) this.setServices(title, services);
		// Search for the progress row and add overview there
		let overview = new Overview(title, services, this);
		overview.displayServices();
		// Check current online Status
		await this.checkServiceStatus(title, services);
		overview.updateMainOverview();
		// When the Title is synced, all remaining ServiceTitle are synced with it
		if (title.status != Status.NONE) this.syncServices(title, services, overview.syncEvents, true);
	};

	updatesPage = (): void => {
		console.log('SyncDex :: Updates');
	};
}

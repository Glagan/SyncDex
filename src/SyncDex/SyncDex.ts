import { Router } from './Router';
import { Options } from '../Core/Options';
import { ChapterGroup } from './ChapterGroup';
import { DOM } from '../Core/DOM';
import {
	TitleCollection,
	ServiceKeyType,
	ReverseActivableName,
	ActivableKey,
	Title,
	StatusMap,
	iconToService,
} from '../Core/Title';
import { TitleOverview, ReadingOverview } from './Overview';
import { Mochi } from '../Core/Mochi';
import { GetService } from './Service';
import { injectScript, stringToProgress, progressToString } from '../Core/Utility';
import { Runtime } from '../Core/Runtime';
import { Thumbnail } from './Thumbnail';
import { SyncModule } from './SyncModule';
import { TitleGroup } from './TitleGroup';
import { History } from './History';

interface ReadingState {
	syncModule?: SyncModule;
	title?: Title;
}

interface FollowPageResult {
	titles: { [key: number]: number };
	isLastPage: boolean;
	maxPage: number;
	requestTime: number;
	code: number;
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
		this.router.register('/history$', this.historyPage);
	}

	execute = (location: string): void => {
		const fnct = this.router.match(location);
		if (fnct) fnct();
	};

	chapterList = async (): Promise<any> => {
		console.log('SyncDex :: Chapter List');

		if (!Options.hideHigher && !Options.hideLast && !Options.hideLower && !Options.thumbnail && !Options.highlight)
			return;

		const groups = ChapterGroup.getGroups();
		const titles = await TitleCollection.get(
			groups.map((group) => {
				return group.id;
			})
		);

		// Hide, Highlight and add Thumbnails to each row
		for (const group of groups) {
			const title = titles.find(group.id);
			if (title !== undefined && title.inList) {
				group.findNextChapter(title);
				if (Options.hideHigher || Options.hideLast || Options.hideLower) group.hide(title);
				if (Options.highlight) group.highlight(title);
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

	syncShowResult = async (
		state: ReadingState,
		created: boolean,
		completed: boolean,
		firstRequest: boolean,
		localUpdated: boolean
	): Promise<void> => {
		if (state.title == undefined) return;
		const report = await state.syncModule!.syncExternal();
		state.syncModule!.displayReportNotifications(report, created, completed, firstRequest, localUpdated);
	};

	setStateProgress = (state: ReadingState, progress: Progress, created: boolean): boolean => {
		if (!state.title) return false;
		let completed = false;
		if (
			progress.oneshot ||
			(state.title.max?.chapter && state.title.max.chapter <= progress.chapter) ||
			(progress.volume && state.title.max?.volume && state.title.max.volume <= progress.volume)
		) {
			state.title.status = Status.COMPLETED;
			if (!state.title.end) {
				state.title.end = new Date();
				completed = true;
			}
		} else {
			state.title.status = Status.READING;
		}
		state.title.progress = progress;
		if (created && !state.title.start) {
			state.title.start = new Date();
		}
		if (Options.saveOpenedChapters) {
			state.title.addChapter(progress.chapter);
		}
		return completed;
	};

	chapterEvent = async (details: ChapterChangeEventDetails, state: ReadingState): Promise<void> => {
		// console.log(details);
		// Get the Title and Services initial state on the first chapter change
		const id = details.manga._data.id;
		let firstRequest = false;
		if (state.title == undefined) {
			state.title = await Title.get(id);
			if (Options.biggerHistory) await History.load();
			if (details.manga._data.title != '') state.title.name = details.manga._data.title;
			firstRequest = true;
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
					const serviceKey = iconToService(key);
					if (serviceKey !== undefined) {
						(state.title.services[serviceKey] as ServiceKeyType) = GetService(
							ReverseActivableName[serviceKey]
						).idFromString(services[key as MangaDexExternalKeys]);
					}
				}
			}
			// Find MangaDex status if needed -- TODO: Check if logged in
			if (Options.updateOnlyInList || Options.updateMD) {
				const response = await Runtime.request<RawResponse>({
					method: 'GET',
					url: `https://mangadex.org/title/${id}`,
					credentials: 'include',
				});
				if (!response.ok) {
					SimpleNotification.error({
						text: `Error while getting **MangaDex** Status.\ncode: **${response.code}**`,
					});
				} else {
					// Find mdStatus
					const status = /disabled dropdown-item manga_follow_button'\s*data-manga-id='\d+'\s*id='(\d+)'/.exec(
						response.body
					);
					if (status) state.title.mdStatus = parseInt(status[1]);
					// Find mdScore
					const score = /disabled dropdown-item manga_rating_button'\s*id='(\d+)'/.exec(response.body);
					if (score) state.title.mdScore = parseInt(score[1]) * 10;
				}
			}
			// Find max
			const lastChapter = parseFloat(details.manga._data.last_chapter);
			if (!isNaN(lastChapter) && lastChapter > 0) {
				state.title.max = {
					chapter: lastChapter,
					volume: details.manga._data.last_volume ? details.manga._data.last_volume : undefined,
				};
			}
		}
		// Send initial requests -- Another if block to tell Typescript state.syncModule does exist
		if (state.syncModule == undefined) {
			state.syncModule = new SyncModule(state.title, new ReadingOverview());
			state.syncModule.initialize();
		}
		// Check initial Status if it's the first time
		if (firstRequest && Options.services.length > 0) {
			await state.syncModule.syncLocal();
		}
		// Find current Chapter Progress
		const created = state.title.status == Status.NONE || state.title.status == Status.PLAN_TO_READ;
		let completed = false;
		const oneshot = details._data.title == 'Oneshot';
		const currentProgress: Progress = {
			chapter: oneshot ? 0 : parseFloat(details._data.chapter),
			oneshot: oneshot,
		};
		if (details._data.volume !== '') currentProgress.volume = parseInt(details._data.volume);
		const confirmButtons = (): Button[] => [
			{
				type: 'success',
				value: 'Update',
				onClick: async (notification: SimpleNotification) => {
					notification.closeAnimated();
					const completed = this.setStateProgress(state, currentProgress, created);
					await state.title!.persist();
					this.syncShowResult(state, created, completed, false, true);
				},
			},
			{
				type: 'message',
				value: 'Close',
			},
		];
		// Exit early if there is no progress
		if (isNaN(currentProgress.chapter)) {
			if (Options.errorNotifications) {
				SimpleNotification.error({
					title: 'No Chapter found',
					text: 'No Chapter could be found and no progress was saved.',
				});
			}
			// Execute basic first request sync if needed before leaving
			// Only sync if Title has a Status to be synced to
			await state.title.persist();
			if (firstRequest && Options.services.length > 0 && state.title.status !== Status.NONE) {
				const report = await state.syncModule.syncExternal();
				state.syncModule.displayReportNotifications(report, created, false, firstRequest, false);
			}
			return;
		}
		// Check if the title is in list if required
		let canUpdate = true;
		if (Options.updateOnlyInList) {
			canUpdate = state.title.mdStatus !== undefined && state.title.mdStatus !== Status.NONE;
			if (!canUpdate && Options.confirmChapter) {
				SimpleNotification.warning({
					title: 'Not in your List',
					text: `**${state.title.name}** is not your **MangaDex** List and won't be updated.`,
					buttons: confirmButtons(),
				});
			}
		}
		// Update title state if not delayed -- Handle external titles as delayed
		const delayed = details._data.status != 'OK'; // && details._data.status != 'external';
		if (delayed && Options.confirmChapter) {
			SimpleNotification.warning({
				title: 'External or Delayed',
				image: `https://mangadex.org/images/manga/${id}.thumb.jpg`,
				text: `**${state.title.name}** Chapter **${details._data.chapter}** is delayed or external and has not been updated.`,
				buttons: confirmButtons(),
			});
		}
		// Check if currentProgress should be updated
		let doUpdate = canUpdate && !delayed;
		if (doUpdate) {
			const isFirstChapter = state.title.progress.chapter == 0 && currentProgress.chapter == 0;
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && (isFirstChapter || state.title.isNextChapter(currentProgress))) ||
				(Options.saveOnlyHigher && (isFirstChapter || state.title.progress.chapter < currentProgress.chapter))
			) {
				completed = this.setStateProgress(state, currentProgress, created);
			} else if (Options.confirmChapter && (Options.saveOnlyNext || Options.saveOnlyHigher)) {
				doUpdate = false;
				SimpleNotification.info({
					title: 'Chapter Not Higher',
					image: `https://mangadex.org/images/manga/${id}.thumb.jpg`,
					text: `**${state.title.name}** Chapter **${details._data.chapter}** is not the next or higher and hasn't been updated.`,
					buttons: confirmButtons(),
				});
			}
		}
		// Always Update History values if enabled, do not look at other options
		if (Options.biggerHistory) {
			state.title.lastChapter = details._data.id;
			state.title.lastRead = Date.now();
			state.title.history = state.title.progress;
			History.add(state.title.id);
			History.save();
		}
		await state.title.persist(); // Always save
		// Always Sync Services -- even if doUpdate is set to false, to sync any out of sync services
		if ((firstRequest && Options.services.length > 0) || doUpdate) {
			this.syncShowResult(state, created, completed, firstRequest, doUpdate);
		}
	};

	chapterPage = (): void => {
		console.log('SyncDex :: Chapter');

		if (Options.services.length == 0 && Options.errorNotifications) {
			SimpleNotification.error({
				title: 'No active Services',
				text: `You have no **active Services** !\nEnable one in the **Options** and refresh this page.\nAll Progress is still saved locally.`,
				buttons: [
					{
						type: 'info',
						value: 'Options',
						onClick: (notification: SimpleNotification) => {
							Runtime.openOptions();
							notification.closeAnimated();
						},
					},
					{
						type: 'message',
						value: 'Close',
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
			syncModule: undefined,
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

	titlePage = async (): Promise<void> => {
		console.log('SyncDex :: Title');

		// Get Title
		const id = parseInt(document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!);
		const title = await Title.get(id);
		title.lastTitle = Date.now();
		if (!title.inList || title.name === undefined || title.name == '') {
			const headerTitle = document.querySelector('h6.card-header');
			if (headerTitle) title.name = headerTitle.textContent!.trim();
		}
		// Get MangaDex Status
		const statusButton = document.querySelector('.manga_follow_button.disabled');
		if (statusButton) title.mdStatus = parseInt(statusButton.id.trim());
		// Get MangaDex Score
		const scoreButton = document.querySelector('.manga_rating_button.disabled');
		if (scoreButton) title.mdScore = parseInt(scoreButton.id.trim()) * 10;
		// Max progress if it's available
		const maxChapter = document.getElementById('current_chapter');
		if (maxChapter && maxChapter.nextSibling && maxChapter.nextSibling.textContent) {
			const chapter = /\/(\d+)/.exec(maxChapter.nextSibling.textContent);
			if (chapter) {
				title.max = {
					chapter: parseInt(chapter[1]),
				};
			}
		}
		const maxVolume = document.getElementById('current_volume');
		if (maxVolume && maxVolume.nextSibling && maxVolume.nextSibling.textContent) {
			const volume = /\/(\d+)/.exec(maxVolume.nextSibling.textContent);
			if (volume) {
				if (!title.max) title.max = { volume: parseInt(volume[1]) };
				else title.max.volume = parseInt(volume[1]);
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
		const pickLocalServices = !Options.useMochi || fallback;
		const localServices: { [key in ActivableKey]?: [HTMLElement, ServiceKeyType] } = {};
		const informationTable = document.querySelector('.col-xl-9.col-lg-8.col-md-7')!;
		// Look for the "Information:" column
		let informationRow = Array.from(informationTable.children).find(
			(row) => row.firstElementChild?.textContent == 'Information:'
		);
		if (pickLocalServices || Options.linkToServices) {
			if (informationRow) {
				const services = informationRow.querySelectorAll<HTMLImageElement>('img');
				for (const serviceIcon of services) {
					const serviceLink = serviceIcon.nextElementSibling as HTMLAnchorElement;
					// Convert icon name to ServiceKey, only since kt is ku
					const serviceKey = iconToService(serviceIcon.src);
					if (serviceKey !== undefined) {
						const id = GetService(ReverseActivableName[serviceKey]).idFromLink(serviceLink.href);
						localServices[serviceKey] = [serviceLink.parentElement!, id];
						if (pickLocalServices) {
							(title.services[serviceKey] as ServiceKeyType) = id;
						}
					}
				}
			} // Nothing to do if there is no row
		}
		await title.persist(); // Always save

		// Add link to Services if they are missing
		if (Options.linkToServices && !pickLocalServices) {
			// Create a row for the links if there isn't one
			if (!informationRow) {
				informationRow = DOM.create('div', {
					class: 'row m-0 py-1 px-0 border-top',
					childs: [
						DOM.create('div', { class: 'col-lg-3 col-xl-2 strong', textContent: 'Information:' }),
						DOM.create('div', {
							class: 'col-lg-9 col-xl-10',
							childs: [DOM.create('ul', { class: 'list-inline mb-0' })],
						}),
					],
				});
				// Insert before the *Reading Progres* -- and before Overview
				const progressRow = document.querySelector('.reading_progress')!.parentElement!;
				progressRow.parentElement!.insertBefore(informationRow, progressRow);
			}
			const serviceList = informationRow.querySelector('ul')!;
			// Add Links
			for (const key of Object.values(ActivableKey)) {
				const localService = localServices[key];
				if (title.services[key] == undefined) continue;
				const serviceName = ReverseActivableName[key];
				// If there is no localService add a link
				if (localService == undefined) {
					const link = DOM.create('li', {
						class: 'list-inline-item',
						childs: [
							DOM.create('img', { src: Runtime.icon(key), title: serviceName }),
							DOM.space(),
							DOM.create('a', {
								href: GetService(serviceName).link(title.services[key]!),
								target: '_blank',
								textContent: `${serviceName} (SyncDex)`,
							}),
						],
					});
					serviceList.appendChild(link);
				} else if (!GetService(serviceName).compareId(title.services[key]!, localService[1])) {
					DOM.append(
						localService[0],
						DOM.space(),
						DOM.create('a', {
							href: GetService(serviceName).link(title.services[key]!),
							target: '_blank',
							textContent: '(SyncDex)',
						})
					);
				}
			}
		}

		const overview = new TitleOverview();
		// Load each Services to Sync
		const syncModule = new SyncModule(title, overview);
		syncModule.initialize();
		// Find if logged in on MangaDex
		syncModule.loggedIn = !!document.querySelector('button[title="You need to log in to use this function."]');
		const imported = await syncModule.syncLocal();
		if (Options.saveOpenedChapters && imported) title.addChapter(title.progress.chapter);

		// Add all chapters from the ChapterList if it's a new Title
		if (Options.saveOpenedChapters && imported) {
			for (const row of overview.chapterList.rows) {
				if (row.chapter < title.progress.chapter) {
					title.addChapter(row.chapter);
				}
			}
			// Highlight again if the chapter list needs update
			overview.chapterList.highlight(title);
		}

		// Save added previous opened chapters and highest chapter
		const highest = overview.chapterList.highest;
		if (Options.biggerHistory && (!title.highest || title.highest < highest)) {
			title.highest = highest;
		}
		if (imported || Options.biggerHistory) await title.persist();

		// When the Title is synced, all remaining ServiceTitle are synced with it
		if (title.status != Status.NONE) await syncModule.syncExternal(true);
	};

	updatesPage = async (): Promise<void> => {
		console.log('SyncDex :: Updates');

		if (!Options.hideHigher && !Options.hideLast && !Options.hideLower && !Options.highlight) return;

		const groups = TitleGroup.getGroups();
		const ids = groups.map((group) => group.id);
		const titles = await TitleCollection.get(ids);

		// Hide or Highlight groups -- no need for Thumbnails
		for (const group of groups) {
			const title = titles.find(group.id);
			if (!title || !title.inList) continue;
			if (Options.hideHigher || Options.hideLast || Options.hideLower) group.hide(title);
			if (Options.highlight) group.highlight(title);
		}

		// Button to toggle hidden chapters
		const rows = document.querySelectorAll('.hidden');
		const hiddenCount = rows.length;
		const topBar = document.querySelector<HTMLElement>('h6.card-header')!;
		if (topBar && hiddenCount > 0) {
			const icon = DOM.icon('eye');
			const linkContent = DOM.create('span', { textContent: `Show Hidden ${hiddenCount}` });
			const button = DOM.create('button', {
				class: 'btn btn-secondary',
				childs: [icon, DOM.space(), linkContent],
			});
			let active = false;
			let shortenedTitles = document.querySelectorAll<HTMLTableDataCellElement>('td[data-original-span]');
			button.addEventListener('click', (event) => {
				event.preventDefault();
				rows.forEach((row) => {
					row.classList.toggle('visible');
				});
				shortenedTitles.forEach((row) => {
					const span = row.rowSpan;
					row.rowSpan = parseInt(row.dataset.originalSpan!);
					row.dataset.originalSpan = `${span}`;
				});
				icon.classList.toggle('fa-eye');
				icon.classList.toggle('fa-eye-slash');
				if (active) linkContent.textContent = `Show Hidden (${hiddenCount})`;
				else linkContent.textContent = `Hide Hidden (${hiddenCount})`;
				active = !active;
			});
			topBar.classList.add('top-bar-updates');
			topBar.appendChild(button);
		}
	};

	async fetchFollowPage(parser: DOMParser, page: number): Promise<FollowPageResult | false> {
		const before = Date.now();
		const response = await Runtime.request({
			url: `https://mangadex.org/follows/chapters/0/${page}/`,
			method: 'GET',
			cache: 'no-cache',
			credentials: 'include',
			redirect: 'follow',
		});
		const result: FollowPageResult = {
			titles: {},
			isLastPage: false,
			maxPage: 0,
			requestTime: Date.now() - before,
			code: response.code,
		};
		if (response.code >= 200 && response.code < 400) {
			// Get titles
			const body = parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll<HTMLElement>('[data-manga-id]');
			for (const row of rows) {
				const id = parseInt(row.dataset.mangaId!);
				const chapter = parseFloat(row.dataset.chapter!);
				if (isNaN(id) || isNaN(chapter)) continue;
				if (result.titles[id] === undefined) {
					result.titles[id] = chapter;
				} else {
					result.titles[id] = Math.max(result.titles[id], chapter);
				}
			}
			// Last page
			const lastPageNode = body.querySelector('nav > ul.pagination > li.disabled:last-child');
			result.isLastPage = lastPageNode != null;
			// Page count
			if (result.isLastPage) {
				result.maxPage = page;
			} else {
				const maxPageNode = body.querySelector<HTMLAnchorElement>(
					`nav > ul.pagination > .page-item:last-child > a[href^='/follows/chapters/0/']`
				);
				if (maxPageNode) {
					const res = /\/follows\/chapters\/\d\/(\d+)\/?/.exec(maxPageNode.href);
					result.maxPage = res !== null ? parseInt(res[1]) : page;
				}
			}
		} else {
			result.isLastPage = true;
			SimpleNotification.error({
				title: 'MangaDex Error',
				text: `There was an error while making a request to **MangaDex**, retry later.\ncode: ${result.code}`,
			});
			return false;
		}
		return result;
	}

	historyPage = async (): Promise<void> => {
		console.log('SyncDex :: History Page');

		if (!Options.biggerHistory) return;

		// Load Titles
		await History.load();
		const titles = await TitleCollection.get(History.ids);

		// Helper function
		const container = document.getElementById('history')!;
		const infoNode = container.querySelector('p')!;
		infoNode.textContent = `Your last read titles are listed below.`;

		// Add current elements to the history - first one is inserted last
		const currentHistory = Array.from(
			document.querySelectorAll('.large_logo.rounded.position-relative.mx-1.my-2')
		).reverse();
		for (const node of currentHistory) {
			const chapterLink = node.querySelector<HTMLAnchorElement>(`a[href^='/chapter/']`)!;
			const titleLink = node.querySelector<HTMLAnchorElement>(`a[href^='/title/']`)!;
			const id = parseInt(/\/title\/(\d+)(?:\/.+)?/.exec(titleLink.href)![1]);
			const chapter = parseInt(/\/chapter\/(\d+)/.exec(chapterLink.href)![1]);
			// Update lastChapter
			const title = History.find(id) < 0 ? await Title.get(id) : titles.find(id);
			if (title) {
				if (!title.inList) {
					title.name = node.querySelector<HTMLElement>('.manga_title')!.textContent!;
					title.lastChapter = chapter;
					// Progress
					const progress = stringToProgress(chapterLink.textContent!);
					if (!progress) continue;
					title.progress = progress;
					// If it's not in history it wasn't loaded, add it to the collection
					titles.add(title);
					History.add(id);
				}
				if (title.lastChapter !== chapter) {
					title.lastChapter = chapter;
				}
			}
		}
		await titles.save();
		await History.save();

		// Display History
		const historyCards: { [key: number]: HTMLElement } = {};
		for (const id of History.ids) {
			const title = titles.find(id);
			if (title !== undefined) {
				const exist = container.querySelector(`a[href^='/title/${id}']`);
				let card: HTMLElement;
				if (!exist) {
					card = History.buildCard(title);
					container.insertBefore(card, container.lastElementChild);
				} else {
					card = exist.parentElement!.parentElement!;
				}
				History.updateCard(card, title);
				History.highlight(card, title);
				historyCards[id] = card;
			}
		}

		// Activate Tooltips
		injectScript(() => {
			// prettier-ignore
			/// @ts-ignore
			$(() => { $('[data-toggle="tooltip"]').tooltip(); });
		});

		// Initialize Check -- Limit to every 24 hours
		const initialized = History.last === undefined;
		let pauseTimer = false;
		if (History.last === undefined || Date.now() - History.last >= 24 * 60 * 60 * 1000) {
			const alert = DOM.create('div', {
				class: 'alert alert-primary',
				textContent: initialized
					? `You refresh your history more than 24h ago and you can refresh it again.
						It is not recommended to do it often, and it does nothing if you didn't add new titles to your MangaDex list.`
					: `You never initialized your History.
						It is recommend to do it at least once to highlight every cards.`,
			});
			let busy = false;
			const refreshButton = DOM.create('button', {
				class: 'btn btn-primary',
				textContent: `Refresh${History.page ? ` (Continue from page ${History.page})` : ''}`,
				events: {
					click: async (event) => {
						event.preventDefault();
						if (!busy) {
							refreshButton.disabled = true;
							busy = true;
							alert.classList.add('hidden', 'full');
							const parser = new DOMParser();
							const firstRow = document.createElement('span');
							const secondRow = document.createElement('span');
							const progress = DOM.create('div', {
								class: 'alert alert-secondary loading',
								childs: [firstRow, DOM.create('br'), secondRow],
							});
							alert.parentElement!.insertBefore(progress, alert.nextElementSibling!);
							pauseTimer = true;
							// Fetch ALL pages until it is done
							const historySize = History.ids.length;
							const localTitles = new TitleCollection();
							const toSave = new TitleCollection();
							const found: string[] = [];
							if (History.page === undefined) History.page = 1;
							let alreadyLoaded: number[] = [];
							let average = 0;
							let maxPage = 1;
							const before = Date.now();
							while (true) {
								// Display loading status
								firstRow.textContent = `Loading Follow page ${History.page} out of ${maxPage}, found ${found.length} out of ${historySize} Titles.`;
								// Wait between MangaDex requests
								if (History.page > 1) {
									const estimated = Math.floor(((1500 + average) * (maxPage - History.page)) / 1000);
									const disp = [];
									if (estimated >= 60) disp.push(`${Math.floor(estimated / 60)}min `);
									disp.push(`${estimated % 60}s`);
									secondRow.textContent = `Estimated time to complete ${disp.join('')}.`;
									await new Promise((resolve) => setTimeout(resolve, 1500));
								}
								const res = await this.fetchFollowPage(parser, History.page);
								if (res === false) break;
								const { titles, isLastPage, requestTime } = res;
								// Filter found titles to avoid loading them again for nothing
								const foundIds = Object.keys(titles).map((id) => parseInt(id));
								let titleIds = foundIds.filter((id) => {
									return alreadyLoaded.indexOf(id) < 0;
								});
								// Update local data for new found titles
								if (titleIds.length > 0) {
									alreadyLoaded.push(...titleIds);
									localTitles.merge(await TitleCollection.get(titleIds));
								}
								for (const id in titles) {
									// Only update if the title is in local save and has an history card
									const title = localTitles.find(parseInt(id));
									if (
										title !== undefined &&
										title.status !== Status.NONE &&
										historyCards[id] !== undefined
									) {
										const highestChapter = Math.max(titles[id], title.highest || 0);
										if (highestChapter <= title.progress.chapter) {
											historyCards[id].classList.remove('history-down');
											historyCards[id].classList.add('history-up');
										} else if (highestChapter > title.progress.chapter) {
											historyCards[id].classList.remove('history-up');
											historyCards[id].classList.add('history-down');
										}
										if (found.indexOf(id) < 0) {
											found.push(id);
										}
										// Update highest chapter for the titles
										if (!title.highest || title.highest < highestChapter) {
											title.highest = highestChapter;
											toSave.add(title);
										}
									}
								}
								if (History.page == 1) {
									average = requestTime;
								} else {
									average = (average + requestTime) / 2;
								}
								maxPage = res.maxPage;
								// Save updated titles every loop if the user reload the History.page
								if (toSave.length > 0) {
									await toSave.save();
									toSave.collection = [];
								}
								await History.save();
								if (isLastPage) break;
								History.page++;
							}
							// Update with initializedHistory and the last time
							if (History.page == maxPage) {
								History.last = Date.now();
								History.page = undefined;
							}
							await History.save();
							// Done
							pauseTimer = false;
							progress.className = 'alert alert-success';
							const totalTime = Math.floor((Date.now() - before) / 1000);
							const disp = [];
							if (totalTime >= 60) disp.push(`${Math.floor(totalTime / 60)}min `);
							disp.push(`${totalTime % 60}s`);
							progress.textContent = `Done ! ${
								History.page ? History.page : maxPage
							} pages were loaded in ${disp.join('')}.`;
							const closeButton = DOM.create('button', {
								class: 'btn btn-primary',
								textContent: 'Close',
								events: {
									click: (event) => {
										event.preventDefault();
										progress.remove();
									},
								},
							});
							DOM.append(progress, DOM.space(), closeButton);
							alert.remove();
							busy = false;
							refreshButton.disabled = false;
							refreshButton.remove();
						}
					},
				},
			});
			DOM.append(alert, DOM.space(), refreshButton);
			infoNode.parentElement!.insertBefore(alert, infoNode);
		}

		// Check status and update highlight every 30min
		if (Options.chapterStatus) {
			const parser = new DOMParser();
			const timer = DOM.create('span', { textContent: '30min' });
			const statusRow = DOM.create('p', { class: 'p-2' });
			infoNode.parentElement!.insertBefore(statusRow, infoNode.nextElementSibling);
			const checkHistoryLatest = async () => {
				let page = 1;
				let maxPage = 1;
				const localTitles = new TitleCollection();
				const toSave = new TitleCollection();
				const alreadyLoaded: number[] = [];
				const found: string[] = [];
				while (page <= 2) {
					// Display loading status
					statusRow.textContent = `Loading Follow page ${page} out of 2.`;
					// Wait between MangaDex requests
					if (page > 1) {
						await new Promise((resolve) => setTimeout(resolve, 1500));
					}
					const res = await this.fetchFollowPage(parser, page);
					if (res === false) break;
					const { titles, isLastPage } = res;
					// Filter found titles to avoid loading them again for nothing
					const foundIds = Object.keys(titles).map((id) => parseInt(id));
					let titleIds = foundIds.filter((id) => {
						return alreadyLoaded.indexOf(id) < 0;
					});
					// Update local data for new found titles
					if (titleIds.length > 0) {
						alreadyLoaded.push(...titleIds);
						localTitles.merge(await TitleCollection.get(titleIds));
					}
					for (const id in titles) {
						// Only update if the title is in local save and has an history card
						const title = localTitles.find(parseInt(id));
						if (title !== undefined && title.status !== Status.NONE && historyCards[id] !== undefined) {
							const highestChapter = Math.max(titles[id], title.highest || 0);
							if (highestChapter <= title.progress.chapter) {
								historyCards[id].classList.remove('history-down');
								historyCards[id].classList.add('history-up');
							} else if (highestChapter > title.progress.chapter) {
								historyCards[id].classList.remove('history-up');
								historyCards[id].classList.add('history-down');
							}
							if (found.indexOf(id) < 0) {
								found.push(id);
							}
							// Update highest chapter for the titles
							if (!title.highest || title.highest < highestChapter) {
								title.highest = highestChapter;
								toSave.add(title);
							}
						}
					}
					maxPage = res.maxPage;
					// Save updated titles every loop if the page is reloaded
					if (toSave.length > 0) {
						await toSave.save();
						toSave.collection = [];
					}
					await History.save();
					if (isLastPage) break;
					page++;
				}
				statusRow.textContent = '';
				DOM.append(statusRow, DOM.text('Next check in'), DOM.space(), timer, DOM.text('.'));
				// Add 30min timeout for the next update
				let untilRefresh = 1800;
				const interval = setInterval(() => {
					if (pauseTimer) return;
					untilRefresh--;
					const min = Math.floor(untilRefresh / 60);
					const sec = Math.floor(untilRefresh % 60);
					timer.textContent = `${min ? `${min}min` : ''}${min && sec ? ' ' : ''}${sec ? `${sec}s` : ''}`;
					if (untilRefresh == 0) {
						clearInterval(interval);
						checkHistoryLatest();
					}
				}, 1000);
			};
			checkHistoryLatest();
		}
	};
}

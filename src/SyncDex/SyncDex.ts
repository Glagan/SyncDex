import { Router } from './Router';
import { Options } from '../Core/Options';
import { ChapterGroup } from './ChapterGroup';
import { DOM } from '../Core/DOM';
import {
	TitleCollection,
	BaseTitle,
	ServiceKeyType,
	ReverseActivableName,
	ActivableKey,
	ExternalTitleList,
	Title,
	StatusMap,
	ReverseServiceName,
	iconToService,
} from '../Core/Title';
import { Overview } from './Overview';
import { Mochi } from '../Core/Mochi';
import { GetService } from './Service';
import { injectScript } from '../Core/Utility';
import { Runtime } from '../Core/Runtime';
import { Thumbnail } from './Thumbnail';
import { SyncModule } from './SyncModule';
import { TitleGroup } from './TitleGroup';

interface ReadingState {
	syncModule?: SyncModule;
	title?: Title;
	services: ExternalTitleList;
	overview?: HTMLElement;
	icons: { [key in ActivableKey]?: HTMLElement };
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
				group.findNextChapter(title.id, title.progress);
				if (Options.hideHigher || Options.hideLast || Options.hideLower) group.hide(title.progress);
				if (Options.highlight) group.highlight(title.progress);
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
		firstRequest: boolean,
		localUpdated: boolean
	): Promise<void> => {
		if (state.title == undefined) return;
		const report = await state.syncModule!.syncServices();
		state.syncModule!.displayReportNotifications(report, created, firstRequest, localUpdated);
	};

	setStateProgress = (state: ReadingState, progress: Progress, created: boolean): void => {
		if (!state.title) return;
		state.title.status = Status.READING;
		state.title.progress = progress;
		if (created) state.title.start = new Date();
		if (Options.saveOpenedChapters) {
			state.title.addChapter(progress.chapter);
		}
	};

	chapterEvent = async (details: ChapterChangeEventDetails, state: ReadingState): Promise<void> => {
		// console.log(details);
		// Get the Title and Services initial state on the first chapter change
		const id = details.manga._data.id;
		let firstRequest = false;
		if (state.title == undefined) {
			state.title = await Title.get(id);
			state.title.name = details.manga._data.title;
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
			// Overview
			state.overview = DOM.create('div', { class: 'col row no-gutters reading-overview' });
			const overviewParent = DOM.create('div', {
				class: 'col-auto row no-gutters p-1',
				childs: [state.overview],
			});
			if (Options.services.length > 0) {
				const actionsRow = document.querySelector('.reader-controls-mode')!;
				actionsRow.parentElement!.insertBefore(overviewParent, actionsRow);
			}
			// Overview Icons
			for (const key of Options.services) {
				state.icons[key] = DOM.create('img', {
					src: Runtime.icon(key),
					title: ReverseServiceName[key],
				});
				state.overview.appendChild(state.icons[key]!);
			}
		}
		// Send initial requests -- Another if block to tell Typescript state.syncModule does exist
		if (state.syncModule == undefined) {
			state.syncModule = new SyncModule(state.title);
			state.syncModule.setEvents({
				beforeRequest: (key) => {
					state.icons[key]?.classList.add('loading');
				},
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
			state.syncModule.initialize();
		}
		// Check initial Status if it's the first time
		if (firstRequest && Options.services.length > 0) {
			await state.syncModule.syncLocalTitle();
			// Update Overview
			for (const key of Options.services) {
				const status = await state.services[key];
				state.icons[key]?.classList.remove('loading');
				if (status instanceof BaseTitle) {
					if (!status.loggedIn) {
						state.icons[key]?.classList.add('error');
					} else {
						state.icons[key]?.classList.add('synced');
					}
				} else state.icons[key]?.classList.add('warning');
			}
		}
		// Find current Chapter Progress
		const created = state.title.status == Status.NONE || state.title.status == Status.PLAN_TO_READ;
		const currentProgress: Progress = {
			chapter: details._data.title == 'Oneshot' ? 0 : parseFloat(details._data.chapter),
		};
		if (details._data.volume !== '') currentProgress.volume = parseInt(details._data.volume);
		// Exit early if there is no progress
		if (isNaN(currentProgress.chapter)) {
			if (Options.errorNotifications) {
				SimpleNotification.error(
					{
						title: 'No Chapter found',
						text: 'No Chapter could be found and no progress was saved.',
					},
					{ position: 'bottom-left' }
				);
			}
			// Execute basic first request sync if needed before leaving
			// Only sync if Title has a Status to be synced to
			await state.title.persist();
			if (firstRequest && Options.services.length > 0 && state.title.status !== Status.NONE) {
				const report = await state.syncModule.syncServices();
				state.syncModule.displayReportNotifications(report, created, firstRequest, false);
			}
			return;
		}
		// Update title state if not delayed -- Handle external titles as delayed
		const delayed = details._data.status != 'OK'; // && details._data.status != 'external';
		let doUpdate = false;
		if (!delayed) {
			// Check if currentProgress should be updated
			const isFirstChapter = state.title.progress.chapter == 0 && currentProgress.chapter == 0;
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && (isFirstChapter || state.title.isNextChapter(currentProgress))) ||
				(Options.saveOnlyHigher && (isFirstChapter || state.title.progress.chapter < currentProgress.chapter))
			) {
				// TODO: Pepper: Set to COMPLETED if currentProgress is ONESHOT
				this.setStateProgress(state, currentProgress, created);
				doUpdate = true;
			} else if (Options.confirmChapter && (Options.saveOnlyNext || Options.saveOnlyHigher)) {
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
									notification.closeAnimated();
									this.setStateProgress(state, currentProgress, created);
									await state.title!.persist();
									this.syncShowResult(state, created, false, true);
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
		} else if (Options.notifications) {
			SimpleNotification.warning(
				{
					title: 'External or Delayed',
					image: `https://mangadex.org/images/manga/${id}.thumb.jpg`,
					text: `**${state.title.name}** Chapter **${details._data.chapter}** is delayed or external and has not been updated.`,
					buttons: [
						{
							type: 'success',
							value: 'Update',
							onClick: async (notification: SimpleNotification) => {
								notification.closeAnimated();
								this.setStateProgress(state, currentProgress, created);
								await state.title!.persist();
								this.syncShowResult(state, created, false, true);
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
		// Update History values if enabled, do not look at other options
		if (Options.biggerHistory) {
			state.title.lastChapter = details._data.id;
			state.title.lastRead = Date.now();
			state.title.history = state.title.progress;
		}
		await state.title.persist(); // Always save
		// Always Sync Services -- even if doUpdate is set to false, to sync any out of sync services
		if ((firstRequest && Options.services.length > 0) || doUpdate) {
			this.syncShowResult(state, created, firstRequest, doUpdate);
		}
	};

	chapterPage = (): void => {
		console.log('SyncDex :: Chapter');

		if (Options.services.length == 0 && Options.errorNotifications) {
			SimpleNotification.error(
				{
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
				},
				{ position: 'bottom-left' }
			);
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
		const chapterRows = document.querySelectorAll<HTMLElement>('.chapter-row');

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

		// Load each Services to Sync
		const syncModule = new SyncModule(title);
		// TODO: Display *SyncDex* tab even if there is no Services
		let overview = new Overview(syncModule);
		syncModule.setEvents({
			beforePersist: (key) => {
				overview.isSyncing(key);
			},
			afterPersist: async (key, response) => {
				if (response > RequestStatus.CREATED) overview.updateOverview(key, response);
				else overview.updateOverview(key, await syncModule.services[key]!);
			},
			alreadySynced: async (key) => {
				overview.updateOverview(key, await syncModule.services[key]!);
			},
		});
		if (Options.services.length > 0) syncModule.initialize();
		overview.displayServices();
		// Check current online Status
		const imported = await syncModule.syncLocalTitle();
		overview.updateMainOverview();

		// Highlight opened chapters
		if (Options.saveOpenedChapters || Options.biggerHistory) {
			if (Options.saveOpenedChapters && imported) title.addChapter(title.progress.chapter);
			// Highlight chapters -- and add a list of previous opened chapters if we just imported
			let highest = 0;
			let nextChapter: HTMLElement | undefined;
			for (const row of chapterRows) {
				// Handle Oneshot as chapter 0
				let chapter = row.dataset.title == 'Oneshot' ? 0 : parseFloat(row.dataset.chapter!);
				if (!isNaN(chapter)) {
					if (chapter > highest) highest = chapter;
					if (Options.saveOpenedChapters) {
						let added = false;
						if (imported && chapter < title.progress.chapter) {
							title.addChapter(chapter);
							added = true;
						}
						// Remove previous Highlight
						row.classList.remove('has-transition');
						row.style.backgroundColor = '';
						// Add Highlight if needed
						// Next Chapter is 0 if it exists and it's a new Title or the first next closest
						if (
							(chapter > title.progress.chapter && chapter < Math.floor(title.progress.chapter) + 2) ||
							(chapter == 0 && title.progress.chapter == 0)
						) {
							nextChapter = row;
						} else if (added || title.chapters.indexOf(chapter) >= 0) {
							row.classList.add('has-transition');
							row.style.backgroundColor = Options.colors.openedChapter;
						}
					}
				}
			}
			if (nextChapter) {
				nextChapter.classList.add('has-transition');
				nextChapter.style.backgroundColor = Options.colors.nextChapter;
			}
			if (Options.biggerHistory && (!title.highest || title.highest < highest)) {
				title.highest = highest;
			}
			// Save added previous opened chapters
			if (imported || Options.biggerHistory) await title.persist();
		}

		// When the Title is synced, all remaining ServiceTitle are synced with it
		if (title.status != Status.NONE) await syncModule.syncServices(true);
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
			if (Options.hideHigher || Options.hideLast || Options.hideLower) group.hide(title.progress);
			if (Options.highlight) group.highlight(title.progress);
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

	historyPage = (): void => {
		console.log('SyncDex :: History Page');
	};
}

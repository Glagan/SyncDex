import { Router } from './Router';
import { Options } from '../Core/Options';
import { DOM } from '../Core/DOM';
import { StatusMap, iconToService } from '../Core/Title';
import { TitleOverview, ReadingOverview } from './Overview';
import { Mochi } from '../Core/Mochi';
import { injectScript, progressFromString } from '../Core/Utility';
import { Runtime } from '../Core/Runtime';
import { Thumbnail } from './Thumbnail';
import { SyncModule, ReportInformations } from '../Core/SyncModule';
import { UpdateGroup } from './UpdateGroup';
import { TitleChapterGroup } from './TitleChapterGroup';
import { History } from './History';
import { ChapterRow } from './ChapterRow';
import { Service } from '../Core/Service';
import { Services } from '../Service/Class/Map';
import { log } from '../Core/Log';
import { ActivableKey } from '../Service/Keys';
import { LocalTitle, TitleCollection } from '../Core/Title';
import { MangaDex } from '../Core/MangaDex';

interface ReadingState {
	syncModule?: SyncModule;
	title?: LocalTitle;
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
	// Chapter page
	readingQueue: ChapterChangeEventDetails[] = [];
	processingReadingQueue: boolean = false;

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

		const groups = TitleChapterGroup.getGroups();
		const titles = await TitleCollection.get([...new Set(groups.map((group) => group.id))]);

		// Check MangaDex login status
		const loggedIn = document.querySelector(`a.nav-link[href^='/user']`) !== null;
		// Hide, Highlight and add Thumbnails to each row
		for (const group of groups) {
			const title = titles.find(group.id);
			if (title !== undefined && title.inList) {
				const syncModule = new SyncModule(title);
				syncModule.loggedIn = loggedIn;
				group.initialize(syncModule);
				group.updateDisplayedRows(title);
			} else if (group.rows.length > 0) {
				// Still add thumbnails and the Group title if it's no in list
				if (Options.thumbnail) {
					for (const row of group.rows) {
						new Thumbnail(group.id, row.node, title);
					}
				}
				group.rows[0].node.firstElementChild!.appendChild(group.titleLink());
			}
		}

		// Button to toggle hidden chapters
		const navBar = document.querySelector<HTMLElement>('#content ul.nav.nav-tabs');
		if (navBar) {
			if (!navBar.classList.contains('hide-loaded')) {
				navBar.classList.add('hide-loaded');
				const toggleButton = TitleChapterGroup.toggleButton;
				toggleButton.button.addEventListener('click', (event) => {
					event.preventDefault();
					let hidden = !toggleButton.button.classList.toggle('show-hidden');
					for (const group of groups) {
						group.toggleHidden(hidden);
					}
					toggleButton.icon.classList.toggle('fa-eye');
					toggleButton.icon.classList.toggle('fa-eye-slash');
					if (hidden) toggleButton.description.textContent = 'Show Hidden';
					else toggleButton.description.textContent = 'Hide Hidden';
				});
				if (navBar.lastElementChild!.classList.contains('ml-auto')) {
					navBar.insertBefore(toggleButton.button, navBar.lastElementChild);
				} else {
					navBar.appendChild(toggleButton.button);
				}
			}

			// Add Language buttons
			ChapterRow.generateLanguageButtons(
				navBar,
				(parent, tab) => {
					parent.insertBefore(tab, parent.lastElementChild);
				},
				() => {
					// Add the Title name in the first column after toggling languages
					let rawVisible = TitleChapterGroup.toggleButton.button.classList.contains('show-hidden');
					for (const titleGroup of groups) {
						for (const group of titleGroup.groups) {
							let addedTitle = false;
							for (const row of group) {
								row.node.firstElementChild!.textContent = '';
								if (
									!addedTitle &&
									(rawVisible || !row.hidden) &&
									row.node.classList.contains('visible-lang')
								) {
									row.node.firstElementChild!.appendChild(titleGroup.titleLink());
									addedTitle = true;
								}
							}
						}
					}
				}
			);
		}
	};

	syncShowResult = async (
		syncModule: SyncModule,
		informations: ReportInformations,
		previousState: LocalTitle
	): Promise<void> => {
		const report = await syncModule.syncExternal();
		syncModule.displayReportNotifications(report, informations, previousState);
	};

	processReadingQueue = async (state: ReadingState): Promise<void> => {
		const details = this.readingQueue.shift();
		if (!details) return;

		// Get the Title and Services initial state on the first chapter change
		const id = details.manga._data.id;
		let firstRequest = false;
		if (state.title == undefined) {
			state.title = await LocalTitle.get(id);
			if (Options.biggerHistory) await History.load();
			// Avoid always updating the name from the API since it can contain HTML entities
			if (details.manga._data.title != '' && !state.title.name) {
				state.title.name = details.manga._data.title;
			}
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
						state.title.services[serviceKey] = Services[serviceKey].idFromString(
							services[key as MangaDexExternalKeys]
						);
					}
				}
			}
			// Find max from MangaDex
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
			// Check if we're logged in on MangaDex
			state.syncModule.loggedIn = document.querySelector(`a.nav-link[href^='/user']`) !== null;
			state.syncModule.initialize();
			// Find MangaDex status if needed
			if (Options.updateOnlyInList || Options.updateMD) {
				const response = await Runtime.jsonRequest<{
					data: {
						userId: number;
						mangaId: number;
						mangaTitle: string;
						followType: number | null;
						volume: string | null;
						chapter: string | null;
						rating: number | null;
					};
				}>({
					method: 'GET',
					url: MangaDex.api('title', id),
					credentials: 'include',
				});
				if (response.ok) {
					if (typeof response.body.data.followType === 'number') {
						state.syncModule.mdState.status = response.body.data.followType;
					}
					if (typeof response.body.data.rating === 'number') {
						state.syncModule.mdState.score = response.body.data.rating * 10;
					}
				} // 403 Error is expected if not logged in
				else if (response.code >= 500) {
					SimpleNotification.error({
						text: `Error while getting **MangaDex** Status.\ncode: **${response.code}**`,
					});
				}
			}
		}
		// Check initial Status if it's the first time
		if (firstRequest && Options.services.length > 0) {
			await state.syncModule.syncLocal();
		}
		// Save State for *Cancel* button
		const previousState = state.syncModule.saveState();
		// Find current Chapter Progress
		const created = state.title.status == Status.NONE || state.title.status == Status.PLAN_TO_READ;
		let completed = false;
		const oneshot = details._data.title.toLocaleLowerCase() == 'oneshot';
		let currentProgress: Progress = {
			chapter: oneshot ? 0 : parseFloat(details._data.chapter),
			oneshot: oneshot,
		};
		const volume = parseInt(details._data.volume);
		if (!isNaN(volume) && volume) currentProgress.volume = volume;
		// Fallback if there is no valid chapter in API response
		if (isNaN(currentProgress.chapter)) {
			currentProgress = progressFromString(details._data.title);
		}
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
				state.syncModule.displayReportNotifications(
					report,
					{
						created: created,
						completed: false,
						firstRequest: firstRequest,
					},
					previousState
				);
			}
			return;
		}
		// Confirms button if updateOnlyInList or updateHigherOnly/updateNextOnly is enabled
		const confirmButtons = (): Button[] => [
			{
				type: 'success',
				value: 'Update',
				onClick: async (notification: SimpleNotification) => {
					notification.closeAnimated();
					const completed = state.title!.setProgress(currentProgress);
					await state.title!.persist();
					await this.syncShowResult(
						state.syncModule!,
						{
							created: created,
							completed: completed,
							localUpdated: true,
						},
						previousState
					);
				},
			},
			{
				type: 'message',
				value: 'Close',
				onClick: (notification) => notification.closeAnimated(),
			},
		];
		// Collect all warnings and reasons to not update to the current Chapter
		let missingUpdateValidations: string[] = [];
		// Update title state if not delayed -- Handle external titles as delayed
		const delayed = details._data.status == 'delayed' || details._data.status == 'external';
		if (delayed && Options.confirmChapter) {
			missingUpdateValidations.push(
				`**${state.title.name}** Chapter **${details._data.chapter}** is delayed or external and has not been updated.`
			);
		}
		// Check if the title is in list if required
		let mdListOptionValid = true;
		if (Options.updateOnlyInList) {
			if (!state.syncModule.loggedIn) {
				SimpleNotification.error({
					title: 'Not Logged In',
					text: `You are not logged in on **MangaDex** but you have the *Update Only in List** option enabled.\nDisable it or login on **MangaDex** !`,
				});
			}
			mdListOptionValid =
				state.syncModule.mdState.status !== undefined && state.syncModule.mdState.status !== Status.NONE;
			if (!mdListOptionValid && Options.confirmChapter) {
				missingUpdateValidations.push(
					`**${state.title.name}** is not your **MangaDex** List and wasn't updated.`
				);
			}
		}
		// Check if currentProgress should be updated and use setStateProgress if needed
		let doUpdate = mdListOptionValid && !delayed;
		if (doUpdate) {
			const isFirstChapter = state.title.progress.chapter == 0 && currentProgress.chapter == 0;
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && (isFirstChapter || state.title.isNextChapter(currentProgress))) ||
				(Options.saveOnlyHigher &&
					!Options.saveOnlyNext &&
					(isFirstChapter || state.title.progress.chapter < currentProgress.chapter))
			) {
				completed = state.title.setProgress(currentProgress);
			} else if (Options.confirmChapter && (Options.saveOnlyNext || Options.saveOnlyHigher)) {
				doUpdate = false;
				missingUpdateValidations.push(
					`**${state.title.name}** Chapter **${details._data.chapter}** is not ${
						Options.saveOnlyNext ? 'the next' : 'higher'
					} and hasn't been updated.`
				);
			}
		}
		// If there is reasons to NOT update automatically to the current progress, display all reasons in a single Notification
		if (missingUpdateValidations.length > 0) {
			SimpleNotification.info({
				title: 'Not Updated',
				image: MangaDex.thumbnail(state.title.key),
				text: missingUpdateValidations.join(`\n`),
				buttons: confirmButtons(),
			});
		}
		// Always Update History values if enabled, do not look at other options
		if (Options.biggerHistory) {
			await state.title.setHistory(details._data.id, currentProgress);
		}
		await state.title.persist(); // Always save
		// If all conditions are met we can sync to current progress
		if (doUpdate) {
			await this.syncShowResult(
				state.syncModule,
				{
					created: created,
					completed: completed,
					firstRequest: firstRequest,
					localUpdated: doUpdate,
				},
				previousState
			);
		}
		// If we do not need to update, we still sync to the current non updated progress but no output
		else if (firstRequest && Options.services.length > 0) await state.syncModule.syncExternal();

		// Next
		if (this.readingQueue.length > 0) {
			return this.processReadingQueue(state);
		}
	};

	chapterPage = (): void => {
		console.log('SyncDex :: Chapter');

		// Check if there is no Services enabled -- Progress is still saved locally
		if (Options.services.length == 0 && Options.errorNotifications) {
			SimpleNotification.error({
				title: 'No active Services',
				text: `You have no **active Services** !\nEnable one in the **Options** and refresh this page.\nAll Progress is still saved locally.`,
				buttons: [
					{
						type: 'info',
						value: 'Options',
						onClick: (notification) => {
							Runtime.openOptions();
							notification.closeAnimated();
						},
					},
					{
						type: 'message',
						value: 'Close',
						onClick: (notification) => notification.closeAnimated(),
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
					// Chrome can't send class Objects
					const detail = { _data: event._data, manga: event.manga };
					delete detail.manga.response;
					document.dispatchEvent(new CustomEvent('ReaderChapterChange', { detail }));
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
			this.readingQueue.push((event as CustomEvent).detail);
			if (!this.processingReadingQueue) {
				this.processingReadingQueue = true;
				await this.processReadingQueue(state);
				this.processingReadingQueue = false;
			}
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
				// TODO: Add "Reading"/"Plan To Read" buttons ?
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
			if (Options.thumbnail && listType != ListType.Grid && listType != ListType.Detailed) {
				new Thumbnail(id, row, title);
			}
		}
	};

	titlePage = async (): Promise<void> => {
		console.log('SyncDex :: Title');
		const overview = new TitleOverview();

		try {
			// Get Title
			const id = parseInt(
				document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!
			);
			const title = await LocalTitle.get(id);
			title.lastTitle = Date.now();
			if (!title.inList || title.name === undefined || title.name == '') {
				const headerTitle = document.querySelector('h6.card-header');
				if (headerTitle) title.name = headerTitle.textContent!.trim();
			}
			// Max progress if it's available
			const maxChapter = document.getElementById('current_chapter');
			if (maxChapter && maxChapter.nextSibling && maxChapter.nextSibling.textContent) {
				const chapter = /\/(\d+)/.exec(maxChapter.nextSibling.textContent);
				if (chapter) {
					title.max = { chapter: parseInt(chapter[1]) };
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
			const localServices: { [key in ActivableKey]?: [HTMLElement, MediaKey] } = {};
			const informationTable = document.querySelector('.col-xl-9.col-lg-8.col-md-7')!;
			// Look for the "Information:" column
			let informationRow = Array.from(informationTable.children).find(
				(row) => row.firstElementChild?.textContent == 'Information:'
			);
			// Nothing to do if there is no row
			if ((pickLocalServices || Options.linkToServices) && informationRow) {
				const services = informationRow.querySelectorAll<HTMLImageElement>('img');
				for (const serviceIcon of services) {
					const serviceLink = serviceIcon.nextElementSibling as HTMLAnchorElement;
					// Convert icon name to ServiceKey, only since kt is ku
					const serviceKey = iconToService(serviceIcon.src);
					if (serviceKey !== undefined) {
						const id = Services[serviceKey].idFromLink(serviceLink.href);
						localServices[serviceKey] = [serviceLink.parentElement!, id];
						if (pickLocalServices) title.services[serviceKey] = id;
					}
				}
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
					const serviceName = Services[key].name;
					// If there is no localService add a link
					if (localService == undefined) {
						const link = DOM.create('li', {
							class: 'list-inline-item',
							childs: [
								DOM.create('img', { src: Runtime.icon(key), title: serviceName }),
								DOM.space(),
								DOM.create('a', {
									href: Services[key].link(title.services[key]!),
									target: '_blank',
									textContent: `${serviceName} (SyncDex)`,
								}),
							],
						});
						serviceList.appendChild(link);
					} else if (!Service.compareId(title.services[key]!, localService[1])) {
						DOM.append(
							localService[0],
							DOM.space(),
							DOM.create('a', {
								href: Services[key].link(title.services[key]!),
								target: '_blank',
								textContent: '(SyncDex)',
							})
						);
					}
				}
			}

			// Load each Services to Sync
			const syncModule = new SyncModule(title, overview);
			// Find MangaDex login status
			syncModule.loggedIn = !document.querySelector('button[title="You need to log in to use this function."]');
			syncModule.initialize();
			// Get MangaDex Status
			const statusButton = document.querySelector('.manga_follow_button.disabled');
			if (statusButton) syncModule.mdState.status = parseInt(statusButton.id.trim());
			// Get MangaDex Score
			const scoreButton = document.querySelector('.manga_rating_button.disabled');
			if (scoreButton) syncModule.mdState.score = parseInt(scoreButton.id.trim()) * 10;
			const imported = await syncModule.syncLocal();

			// Add all chapters from the ChapterList if it's a new Title
			// Update lastChapter for the History if title was synced
			if (imported && (Options.saveOpenedChapters || Options.biggerHistory)) {
				if (Options.saveOpenedChapters) {
					title.updateChapterList(title.progress.chapter);
				}
				for (const row of overview.chapterList.rows) {
					if (Options.biggerHistory && row.progress.chapter == title.progress.chapter) {
						title.lastChapter = row.chapterId;
						if (!Options.saveOpenedChapters) break;
					}
					if (Options.saveOpenedChapters && row.progress.chapter < title.progress.chapter) {
						title.addChapter(row.progress.chapter);
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
		} catch (error) {
			SimpleNotification.error({
				title: error.message,
				text: 'Unexpected error, check logs and open an issue with them.',
			});
			await log(error);
		}
	};

	updatesPage = async (): Promise<void> => {
		console.log('SyncDex :: Updates');

		if (!Options.hideHigher && !Options.hideLast && !Options.hideLower && !Options.highlight) return;

		const groups = UpdateGroup.getGroups();
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

	async fetchFollowPage(page: number): Promise<FollowPageResult | false> {
		const before = Date.now();
		const response = await Runtime.jsonRequest<{
			data: {
				chapters: {
					id: number;
					hash: string;
					mangaId: number;
					mangaTitle: string;
					volume: string;
					chapter: string;
					title: string;
				}[];
			};
		}>({
			url: MangaDex.api('updates', page),
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
			const body = response.body;
			// Get titles
			for (const chapter of body.data.chapters) {
				const id = chapter.mangaId;
				const progressChapter = parseFloat(chapter.chapter);
				if (isNaN(id) || isNaN(progressChapter)) continue;
				if (result.titles[id] === undefined) {
					result.titles[id] = progressChapter;
				} else {
					result.titles[id] = Math.max(result.titles[id], progressChapter);
				}
			}
			// Last page
			result.isLastPage = body.data.chapters.length < 100;
			if (result.isLastPage) result.maxPage = page;
			// else result.maxPage = body.meta.lastPage;
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

	async processFollowPage(
		titles: { [key: number]: number },
		loaded: number[],
		localTitles: TitleCollection,
		historyCards: { [key: number]: HTMLElement },
		found: string[]
	) {
		const foundIds = Object.keys(titles).map((id) => parseInt(id));
		let titleIds = foundIds.filter((id) => {
			return loaded.indexOf(id) < 0;
		});
		// Update local data for new found titles
		if (titleIds.length > 0) {
			loaded.push(...titleIds);
			localTitles.merge(await TitleCollection.get(titleIds));
		}
		const toSave = new TitleCollection();
		for (const id in titles) {
			// Only update if the title is in local save and has an history card
			const title = localTitles.find(parseInt(id));
			if (!title) continue;
			const highestChapter = Math.max(titles[id], title.highest || 0);
			// Update highest chapter for the titles
			if (!title.highest || title.highest < highestChapter) {
				title.highest = highestChapter;
				toSave.add(title);
			}
			if (title.status !== Status.NONE && historyCards[id] !== undefined) {
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
			}
		}
		// Save updated titles every loop if the user reload the History.page
		if (toSave.length > 0) await toSave.persist();
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
		infoNode.textContent = '';
		DOM.append(
			infoNode,
			DOM.create('p', {
				childs: [
					DOM.create('span', { class: 'help history-down', textContent: 'Blue' }),
					DOM.space(),
					DOM.text('Higher chapter available'),
				],
			}),
			DOM.create('p', {
				childs: [
					DOM.create('span', { class: 'help history-up', textContent: 'Green' }),
					DOM.space(),
					DOM.text('Latest chapter read'),
				],
			})
		);

		// Add current elements to the history - first one is inserted last
		const currentHistory = Array.from(
			document.querySelectorAll<HTMLElement>('.large_logo.rounded.position-relative.mx-1.my-2')
		).reverse();
		const addedTitles = new TitleCollection();
		for (const node of currentHistory) {
			const chapterLink = node.querySelector<HTMLAnchorElement>(`a[href^='/chapter/']`)!;
			const titleLink = node.querySelector<HTMLAnchorElement>(`a[href^='/title/']`)!;
			const id = parseInt(/\/title\/(\d+)(?:\/.+)?/.exec(titleLink.href)![1]);
			const chapter = parseInt(/\/chapter\/(\d+)/.exec(chapterLink.href)![1]);
			// Update lastChapter and create title if there is one
			const wasInHistory = History.find(id) >= 0;
			const title = wasInHistory ? titles.find(id) : await LocalTitle.get(id);
			if (title) {
				const progress = progressFromString(chapterLink.textContent!);
				if (isNaN(progress.chapter)) continue;
				if (!title.history) title.history = progress;
				if (title.lastChapter !== chapter) title.lastChapter = chapter;
				if (!title.inList) {
					title.name = node.querySelector<HTMLElement>('.manga_title')!.textContent!;
					title.progress = progress;
					addedTitles.add(title);
				}
				if (!wasInHistory) {
					titles.add(title);
					History.add(id);
				}
			}
		}
		infoNode.appendChild(DOM.text(`Your last ${History.ids.length} opened titles are listed below.`));
		await addedTitles.persist();
		await History.save();

		// Display History
		const historyCards: { [key: number]: HTMLElement } = {};
		for (const id of History.ids) {
			const title = titles.find(id);
			if (title !== undefined && title.history !== undefined) {
				const exist = container.querySelector(`a[href^='/title/${id}']`);
				let card: HTMLElement;
				if (!exist) {
					card = History.buildCard(title);
					container.insertBefore(card, container.lastElementChild);
				} else card = exist.parentElement!.parentElement!;
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
					? `You refreshed your history more than 24h ago and you can refresh it again.
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
							const found: string[] = [];
							if (History.page === undefined) History.page = 1;
							let alreadyLoaded: number[] = [];
							let average = 0;
							let maxPage = 1;
							const before = Date.now();
							while (true) {
								// Display loading status
								firstRow.textContent = `Loading Follow page ${History.page}, found ${found.length} out of ${historySize} Titles.`;
								// Calculate estimated remaining time
								/*if (History.page > 1) {
									const estimated = Math.floor(((1500 + average) * (maxPage - History.page)) / 1000);
									const disp = [];
									if (estimated >= 60) disp.push(`${Math.floor(estimated / 60)}min `);
									disp.push(`${estimated % 60}s`);
									secondRow.textContent = `Estimated time to complete ${disp.join('')}.`;
									await new Promise((resolve) => setTimeout(resolve, 1500));
								}*/
								const res = await this.fetchFollowPage(History.page);
								if (res === false) break;
								const { titles, isLastPage, requestTime } = res;
								maxPage = res.maxPage;
								await this.processFollowPage(titles, alreadyLoaded, localTitles, historyCards, found);
								/*if (History.page == 1) {
									average = requestTime;
								} else average = (average + requestTime) / 2;*/
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
			const timer = DOM.create('span', { textContent: '30min' });
			const statusRow = DOM.create('p', { class: 'p-2' });
			infoNode.parentElement!.insertBefore(statusRow, infoNode.nextElementSibling);
			const checkHistoryLatest = async () => {
				let page = 1;
				const localTitles = new TitleCollection();
				const alreadyLoaded: number[] = [];
				const found: string[] = [];
				while (page <= 2) {
					// Display loading status
					statusRow.textContent = `Loading Follow page ${page} out of 2.`;
					// Wait between MangaDex requests
					if (page > 1) {
						await new Promise((resolve) => setTimeout(resolve, 1500));
					}
					const res = await this.fetchFollowPage(page);
					if (res === false) break;
					const { titles, isLastPage } = res;
					await this.processFollowPage(titles, alreadyLoaded, localTitles, historyCards, found);
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

import { Page } from '../Page';
import { iconToService, LocalTitle, Title } from '../../Core/Title';
import { ReportInformations, SyncModule } from '../../Core/SyncModule';
import { Options } from '../../Core/Options';
import { History } from '../../Core/History';
import { Mochi } from '../../Core/Mochi';
import { Services } from '../../Service/Class/Map';
import { Runtime } from '../../Core/Runtime';
import { MangaDex } from '../../Core/MangaDex';
import { injectScript, progressFromString } from '../../Core/Utility';
import { ActivableKey } from '../../Service/Keys';
import { DOM } from '../../Core/DOM';
import { TitleEditor } from '../../Core/TitleEditor';
import { LogExecTime, TryCatch } from '../../Core/Log';

interface ReadingState {
	syncModule?: SyncModule;
	title?: LocalTitle;
}

type ReaderEvent =
	| 'loadingchange'
	| 'renderingmodechange'
	| 'displayfitchange'
	| 'directionchange'
	| 'chapterchange'
	| 'mangachange'
	| 'statechange'
	| 'currentpagechange'
	| 'readererror'
	| 'pageload'
	| 'pageerror'
	| 'settingchange';

type MangaDexStatus = 'OK' | 'external' | 'delayed'; // Check if there is more

interface MangaDexChapter {
	id: number;
	hash: string;
	mangaId: number;
	chapter: string;
	comments: number;
	groupIds: number[];
	groupWebsite: string | null;
	language: string;
	pages: string[];
	read: boolean;
	server: string | undefined;
	serverFallback: string | undefined;
	status: MangaDexStatus;
	threadId: number | null;
	timestamp: number;
	title: string;
	volume: string;
}

type MangaDexExternalKey =
	| 'al' // Anilist
	| 'amz' // Amazon
	| 'ap' // AnimePlanet
	| 'bw' // BookWalker
	| 'ebj' // eBookJapan
	| 'kt' // Kitsu
	| 'mal' // MyAnimeList
	| 'mu' // MangaUpdates
	| 'nu' // NovelUpdates
	| 'raw' // Raw source
	| 'engtl'; // Official English release

interface MangaDexManga {
	id: number;
	isHentai: boolean;
	language: string;
	lastChapter: string | null;
	lastVolume: string | null;
	links: { [key in MangaDexExternalKey]?: string };
	mainCover: string;
	tags: number[];
	title: string;
}

interface MangaChangeDetails extends MangaDexManga {
	_chapters: MangaDexChapter[];
	_response: Response;
	_uniqueChapters: MangaDexChapter[];
}

interface ChapterChangeDetails {
	_isNetworkServer: boolean;
	_response: Response;
	// Chapter values
	chapter: string;
	comments: number;
	groupIds: number[];
	groupWebsite: string | null;
	hash: string;
	id: number;
	language: string;
	mangaId: number;
	pages: string[];
	read: boolean;
	server: string | undefined;
	serverFallback: string | undefined;
	status: MangaDexStatus;
	threadId: number | null;
	timestamp: number;
	title: string;
	volume: string;
	// Manga object
	manga: MangaChangeDetails;
}

interface MangaDexExtendedManga extends MangaDexManga {
	altTitles: string;
	description: string;
	artist: string[];
	author: string[];
	publication: {
		language: string;
		status: Status;
		demographic: number;
	};
	relations: {
		id: number;
		title: string;
		type: number;
		isHentai: boolean;
	}[];
	ratings: {
		bayesian: number;
		mean: number;
		users: number;
	};
	views: number;
	follows: number;
	comments: number;
	lastUploaded: number;
}

interface MangaDexTitleResponse {
	data: MangaDexExtendedManga;
}

interface MangaDexUserTitleResponse {
	data: {
		userId: number;
		mangaId: number;
		mangaTitle: string;
		followType: number | null;
		volume: string | null;
		chapter: string | null;
		rating: number | null;
	};
}

class ReadingOverview {
	rowContainer: HTMLElement;
	serviceRow: HTMLElement;
	icons: Partial<{ [key in ActivableKey]: HTMLImageElement }> = {};
	editButton: HTMLButtonElement;

	constructor() {
		this.editButton = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('edit'), DOM.space(), DOM.text('Edit')],
		});
		this.serviceRow = DOM.create('div', {
			class: 'col row no-gutters reading-overview',
			childs: [this.editButton],
		});
		this.rowContainer = DOM.create('div', {
			class: 'col-auto row no-gutters p-1',
			childs: [this.serviceRow],
		});
		const actionsRow = document.querySelector('.reader-controls-mode')!;
		actionsRow.parentElement!.insertBefore(this.rowContainer, actionsRow);
	}

	reset() {
		DOM.clear(this.rowContainer);
	}

	bind = (syncModule: SyncModule): void => {
		this.editButton.addEventListener('click', async (event) => {
			event.preventDefault();
			TitleEditor.create(syncModule, async () => {
				this.reset();
				syncModule.initialize();
				await syncModule.syncLocal();
				await syncModule.syncExternal(true);
			}).show();
		});
	};

	updateIcon = (icon: HTMLImageElement, res: Title | RequestStatus): void => {
		icon.classList.remove('loading', 'error', 'synced', 'warning');
		if (!Options.iconsSilentAfterSync) {
			if (res instanceof Title) {
				if (!res.loggedIn) {
					icon.classList.add('error');
				} else {
					icon.classList.add('synced');
				}
			} else icon.classList.add('warning');
		}
	};

	hasNoServices = (): void => {};

	initializeService = (key: ActivableKey, hasId: boolean): void => {
		const icon = DOM.create('img', {
			src: Runtime.icon(key),
			title: Services[key].name,
		});
		if (hasId) {
			icon.classList.add('loading');
		} else if (!Options.iconsSilentAfterSync) {
			icon.classList.add('error');
		}
		this.serviceRow.insertBefore(icon, this.serviceRow.lastElementChild);
		this.icons[key] = icon;
	};

	receivedInitialRequest = (key: ActivableKey, res: Title | RequestStatus, syncModule: SyncModule): void => {
		const icon = this.icons[key];
		if (!icon) return;
		this.updateIcon(icon, res);
	};

	syncingService = (key: ActivableKey): void => {
		const icon = this.icons[key];
		if (!icon) return;
		icon.classList.add('loading');
	};

	syncedService = (key: ActivableKey, res: Title | RequestStatus, title: Title): void => {
		const icon = this.icons[key];
		if (!icon) return;
		this.updateIcon(icon, res);
	};

	syncingLocal = (): void => {};
	syncedLocal = (title: Title): void => {};

	remove() {
		this.rowContainer.remove();
	}
}

interface SimpleChapter {
	id: number;
	title: string;
	chapter: string;
	volume: string;
	status: MangaDexStatus;
}

// @see https://stackoverflow.com/a/63212531/7794671
function initPromise() {
	let _resolve: any = undefined;
	const _promise: any = new Promise((r) => (_resolve = r));
	function resolve() {
		_resolve();
	}
	function promise() {
		return _promise;
	}
	return { resolve, promise };
}

export class ChapterPage extends Page {
	state: ReadingState = {
		title: undefined,
		syncModule: undefined,
	};
	overview?: ReadingOverview = undefined;
	firstRequest: boolean = true;
	reverseChapters: { [key: number]: SimpleChapter } = {};
	loading: {
		inProgress: boolean;
		done: boolean;
		state: { promise: () => Promise<any>; resolve: () => void };
	} = { state: initPromise(), done: false, inProgress: false };
	currentDetails: ChapterChangeDetails | undefined;
	lastChecked: { id: number; page: number } = { id: 0, page: 0 };
	content: HTMLElement;
	queue: { id: number; page: number }[] = [];
	processingQueue: boolean = false;

	constructor() {
		super();
		this.content = document.getElementById('content') as HTMLElement;
	}

	syncShowResult = async (
		syncModule: SyncModule,
		informations: ReportInformations,
		previousState: LocalTitle
	): Promise<void> => {
		const report = await syncModule.syncExternal();
		syncModule.displayReportNotifications(report, informations, previousState);
	};

	@LogExecTime
	getMdUserTitle(id: number): Promise<JSONResponse<MangaDexUserTitleResponse>> {
		return Runtime.jsonRequest<MangaDexUserTitleResponse>({
			method: 'GET',
			url: MangaDex.api('userTitle', id),
			credentials: 'include',
		});
	}

	@TryCatch(Page.errorNotification)
	@LogExecTime
	async initialize(details: MangaChangeDetails): Promise<void> {
		if (this.loading.done) this.loading.state = initPromise();
		this.loading.inProgress = true;
		// Get the Title and Services initial state on the first chapter change
		const id = details.id;
		this.state.title = await LocalTitle.get(id);
		if (Options.biggerHistory) await History.load();
		// Avoid always updating the name from the API since it can contain HTML entities
		if (details.title != '' && !this.state.title.name) {
			this.state.title.name = details.title;
		}
		// Find Services
		let fallback = false;
		if (Options.useMochi) {
			const connections = await Mochi.find(id);
			if (connections !== undefined) {
				Mochi.assign(this.state.title, connections);
			} else fallback = true;
		}
		if (!Options.useMochi || fallback) {
			const services: { [key in MangaDexExternalKey]?: string } = details.links;
			for (const key in services) {
				const serviceKey = iconToService(key);
				if (serviceKey !== undefined && !this.state.title.doForceService(serviceKey)) {
					this.state.title.services[serviceKey] = Services[serviceKey].idFromString(
						services[key as MangaDexExternalKey]!
					);
				}
			}
		}
		// Find max from MangaDex
		if (details.lastChapter) {
			const lastChapter = parseFloat(details.lastChapter);
			if (!isNaN(lastChapter) && lastChapter > 0) {
				this.state.title.max = {
					chapter: parseFloat(details.lastChapter),
					volume: details.lastVolume ? parseInt(details.lastVolume) : undefined,
				};
			}
		}
		// Send initial requests
		if (this.overview) this.overview.remove();
		this.overview = new ReadingOverview();
		this.state.syncModule = new SyncModule(this.state.title, this.overview);
		// Check if we're logged in on MangaDex
		this.state.syncModule.loggedIn = document.querySelector(`a.nav-link[href^='/user']`) !== null;
		this.state.syncModule.initialize();
		// Find MangaDex status if needed
		if (Options.updateOnlyInList || Options.updateMD) {
			const response = await this.getMdUserTitle(id);
			if (response.ok) {
				if (typeof response.body.data.followType === 'number') {
					this.state.syncModule.mdState.status = response.body.data.followType;
				}
				if (typeof response.body.data.rating === 'number') {
					this.state.syncModule.mdState.score = response.body.data.rating * 10;
				}
			} // 403 Error is expected if not logged in
			else if (response.code >= 500) {
				SimpleNotification.error({
					text: `Error while getting **MangaDex** Status.\ncode: **${response.code}**`,
				});
			}
		}
		// Check initial Status if it's the first time
		if (Options.services.length > 0) {
			await this.state.syncModule.syncLocal();
		}
		// Generate reverse chapters
		this.reverseChapters = {};
		for (const chapter of details._chapters) {
			this.reverseChapters[chapter.id] = {
				id: chapter.id,
				title: chapter.title,
				chapter: chapter.chapter,
				volume: chapter.volume,
				status: chapter.status,
			};
		}
		this.loading.inProgress = false;
		this.loading.done = true;
		this.loading.state.resolve();
	}

	@TryCatch(Page.errorNotification)
	@LogExecTime
	async update(details: SimpleChapter): Promise<void> {
		if (!this.state.syncModule || !this.state.title) return;

		// Save State for *Cancel* button
		const previousState = this.state.syncModule.saveState();
		// Find current Chapter Progress
		const created = this.state.title.status == Status.NONE || this.state.title.status == Status.PLAN_TO_READ;
		let completed = false;
		const oneshot = details.title.toLocaleLowerCase() == 'oneshot';
		let currentProgress: Progress = {
			chapter: oneshot ? 0 : parseFloat(details.chapter),
			oneshot: oneshot,
		};
		const volume = parseInt(details.volume);
		if (!isNaN(volume) && volume) currentProgress.volume = volume;
		// Fallback if there is no valid chapter in API response
		if (isNaN(currentProgress.chapter)) {
			currentProgress = progressFromString(details.title);
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
			await this.state.title.persist();
			if (this.firstRequest && Options.services.length > 0 && this.state.title.status !== Status.NONE) {
				const report = await this.state.syncModule.syncExternal();
				this.state.syncModule.displayReportNotifications(
					report,
					{
						created: created,
						completed: false,
						firstRequest: this.firstRequest,
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
					const completed = this.state.title!.setProgress(currentProgress);
					await this.state.title!.persist();
					await this.syncShowResult(
						this.state.syncModule!,
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
		const delayed = details.status == 'delayed' || details.status == 'external';
		if (delayed && Options.confirmChapter) {
			missingUpdateValidations.push(
				`**${this.state.title.name}** Chapter **${details.chapter}** is delayed or external and has not been updated.`
			);
		}
		// Check if the title is in list if required
		let mdListOptionValid = true;
		if (Options.updateOnlyInList) {
			if (!this.state.syncModule.loggedIn) {
				SimpleNotification.error({
					title: 'Not Logged In',
					text: `You are not logged in on **MangaDex** but you have the *Update Only in List** option enabled.\nDisable it or login on **MangaDex** !`,
				});
			}
			mdListOptionValid =
				this.state.syncModule.mdState.status !== undefined &&
				this.state.syncModule.mdState.status !== Status.NONE;
			if (!mdListOptionValid && Options.confirmChapter) {
				missingUpdateValidations.push(
					`**${this.state.title.name}** is not your **MangaDex** List and wasn't updated.`
				);
			}
		}
		// Check if currentProgress should be updated and use setProgress if needed
		let doUpdate = mdListOptionValid && !delayed;
		if (doUpdate) {
			const isFirstChapter = this.state.title.chapter == 0 && currentProgress.chapter == 0;
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && (isFirstChapter || this.state.title.isNextChapter(currentProgress))) ||
				(Options.saveOnlyHigher &&
					!Options.saveOnlyNext &&
					(isFirstChapter || this.state.title.chapter < currentProgress.chapter))
			) {
				completed = this.state.title.setProgress(currentProgress);
			} else if (Options.confirmChapter && (Options.saveOnlyNext || Options.saveOnlyHigher)) {
				doUpdate = false;
				missingUpdateValidations.push(
					`**${this.state.title.name}** Chapter **${details.chapter}** is not ${
						Options.saveOnlyNext ? 'the next' : 'higher'
					} and hasn't been updated.`
				);
			}
		}
		// If there is reasons to NOT update automatically to the current progress, display all reasons in a single Notification
		if (missingUpdateValidations.length > 0) {
			SimpleNotification.info({
				title: 'Not Updated',
				image: MangaDex.thumbnail(this.state.title.key, 'thumb'),
				text: missingUpdateValidations.join(`\n`),
				buttons: confirmButtons(),
			});
		}
		// Always Update History values if enabled, do not look at other options
		if (Options.biggerHistory) {
			await this.state.title.setHistory(details.id, currentProgress);
		}
		await this.state.title.persist(); // Always save
		// If all conditions are met we can sync to current progress
		if (doUpdate) {
			await this.syncShowResult(
				this.state.syncModule,
				{
					created: created,
					completed: completed,
					firstRequest: this.firstRequest,
					localUpdated: doUpdate,
				},
				previousState
			);
		}
		// If we do not need to update, we still sync to the current non updated progress but no output
		else if (this.firstRequest && Options.services.length > 0) await this.state.syncModule.syncExternal();
		if (this.firstRequest) this.firstRequest = false;
	}

	@TryCatch(Page.errorNotification)
	async processQueue(): Promise<void> {
		this.processingQueue = true;
		await this.loading.state.promise();

		while (this.queue.length > 0) {
			const process = this.queue.shift()!;
			const details = this.reverseChapters[process.id];
			if (!details) continue;
			const displayedPage = process.page + parseInt(this.content.dataset.renderedPages!) - 1;
			const isLastPage = displayedPage >= parseInt(this.content.dataset.totalPages!);
			if (
				this.lastChecked.id != process.id &&
				((Options.saveOnLastPage && isLastPage) ||
					(!Options.saveOnLastPage && (process.page == 1 || isLastPage || this.lastChecked.page == 0)))
			) {
				this.lastChecked.id = process.id;
				this.lastChecked.page = process.page;
				await this.update(details);
			}
		}

		this.processingQueue = false;
	}

	@TryCatch(Page.errorNotification)
	async run() {
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

		// Inject script to listen to Reader events
		injectScript(function () {
			// *window* is in the MangaDex page context
			const addEventInterceptor = () => {
				// Track and initialize on mangachange (handle recommendations)
				window.reader!.model.on('mangachange', async (event) => {
					const detail = JSON.parse(JSON.stringify({ ...event }));
					document.dispatchEvent(new CustomEvent('ReaderMangaChange', { detail }));
				});
				window.reader!.model.on('chapterchange', async (event) => {
					// Deep copy and remove Class Objects for Chrome
					const detail = JSON.parse(JSON.stringify({ ...event, manga: event.manga }));
					document.dispatchEvent(new CustomEvent('ReaderChapterChange', { detail }));
				});
				// Page change even only has a number as the event value
				window.reader!.model.on('currentpagechange', (event) => {
					document.dispatchEvent(new CustomEvent('ReaderPageChange', { detail: event }));
				});
			};
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

		// Listen to injected Reader events
		document.addEventListener('ReaderMangaChange', async (event) => {
			// ? Finish processing queue before changing title
			await this.initialize((event as CustomEvent<MangaChangeDetails>).detail);
		});
		document.addEventListener('ReaderChapterChange', (event) => {
			this.currentDetails = (event as CustomEvent<ChapterChangeDetails>).detail;
		});
		const lastChange = { id: 0, page: 0 };
		document.addEventListener('ReaderPageChange', async (event) => {
			if (!this.currentDetails) return;
			const id = parseInt(this.content.dataset.chapterId!);
			const page = (event as CustomEvent<number>).detail;
			if (lastChange.id != id || lastChange.page != page) {
				this.queue.push({ id, page });
				if (!this.processingQueue) {
					this.processQueue();
				}
			}
			lastChange.id = id;
			lastChange.page = page;
		});
	}
}

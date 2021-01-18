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

interface MangaChangeDetails extends MangaDexSimpleManga {
	_chapters: MangaDexChapter[];
	_response: Response;
	_uniqueChapters: MangaDexChapter[];
}

interface ChapterChangeDetails extends MangaDexChapter {
	_isNetworkServer: boolean;
	_response: Response;
	manga: MangaChangeDetails;
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
	volumeChapterReset?: HTMLElement;

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
		this.volumeChapterReset?.remove();
	}

	addVolumeResetChapters() {
		const chaptersSelector = document.querySelector<HTMLElement>('div.reader-controls-chapters');
		if (chaptersSelector) {
			this.volumeChapterReset = DOM.create('div', {
				class: 'col-auto row align-items-center volume-reset-chapter',
				title: `This Title reset chapters every volume.\nSyncDex detected that and will try to persist a real chapter.`,
				childs: [
					DOM.create('span', {
						class: 'badge bg-info text-dark mb-2',
						childs: [DOM.icon('info-circle'), DOM.space(), DOM.text('Volume reset chapters')],
					}),
				],
			});
			chaptersSelector.parentElement!.insertBefore(this.volumeChapterReset, chaptersSelector.nextElementSibling);
		}
	}
}

interface SimpleChapter {
	id: number;
	title: string;
	chapter: string;
	volume: string;
	status: MangaDexStatus;
	progress: Progress;
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
	syncModule?: SyncModule;
	title?: LocalTitle;
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

	chapterProgress(details: MangaDexChapter): Progress {
		const oneshot = details.title.toLocaleLowerCase() == 'oneshot';
		let progress: Progress = {
			chapter: oneshot ? 0 : parseFloat(details.chapter),
			oneshot: oneshot,
		};
		const volume = parseInt(details.volume);
		if (!isNaN(volume) && volume) progress.volume = volume;
		// Fallback if there is no valid chapter in API response
		if (isNaN(progress.chapter)) {
			progress = progressFromString(details.title);
		}
		return progress;
	}

	updateReverseChapters() {
		let previous = 0;
		for (const key in this.reverseChapters) {
			if (Object.prototype.hasOwnProperty.call(this.reverseChapters, key)) {
				const chapter = this.reverseChapters[key];
				this.title!.updateProgressFromVolumes(chapter.progress);
				if (chapter.progress.chapter <= previous) {
					if (previous - Math.floor(previous) >= 0.5) {
						chapter.progress.chapter += 0.1;
					} else chapter.progress.chapter += 0.5;
				}
				previous = chapter.progress.chapter;
			}
		}
	}

	@TryCatch(Page.errorNotification)
	@LogExecTime
	async initialize(details: MangaChangeDetails): Promise<void> {
		if (this.loading.done) this.loading.state = initPromise();
		this.loading.inProgress = true;
		// Get the Title and Services initial state on the first chapter change
		const id = details.id;
		this.title = await LocalTitle.get(id);
		if (Options.biggerHistory) await History.load();
		// Avoid always updating the name from the API since it can contain HTML entities
		if (details.title != '' && !this.title.name) {
			this.title.name = details.title;
		}
		// Find Services
		let fallback = false;
		if (Options.useMochi) {
			const connections = await Mochi.find(id);
			if (connections !== undefined) {
				Mochi.assign(this.title, connections);
			} else fallback = true;
		}
		if (!Options.useMochi || fallback) {
			const services: { [key in MangaDexExternalKey]?: string } = details.links;
			for (const key in services) {
				const serviceKey = iconToService(key);
				if (serviceKey !== undefined && !this.title.doForceService(serviceKey)) {
					this.title.services[serviceKey] = Services[serviceKey].idFromString(
						services[key as MangaDexExternalKey]!
					);
				}
			}
		}
		// Find max from MangaDex
		if (details.lastChapter) {
			const lastChapter = parseFloat(details.lastChapter);
			if (!isNaN(lastChapter) && lastChapter > 0) {
				this.title.max = {
					chapter: parseFloat(details.lastChapter),
					volume: details.lastVolume ? parseInt(details.lastVolume) : undefined,
				};
			}
		}
		// Send initial requests
		if (this.overview) this.overview.remove();
		this.overview = new ReadingOverview();
		this.syncModule = new SyncModule(this.title, this.overview);
		// Check if we're logged in on MangaDex
		this.syncModule.loggedIn = document.querySelector(`a.nav-link[href^='/user']`) !== null;
		this.syncModule.initialize();
		// Find MangaDex status if needed
		if (Options.updateOnlyInList || Options.updateMD) {
			const response = await this.getMdUserTitle(id);
			if (response.ok) {
				if (typeof response.body.data.followType === 'number') {
					this.syncModule.mdState.status = response.body.data.followType;
				}
				if (typeof response.body.data.rating === 'number') {
					this.syncModule.mdState.score = response.body.data.rating * 10;
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
			await this.syncModule.syncLocal();
		}
		// Generate reverse chapters and check if the Title reset chapter on each volumes
		let lastVolume: number = 0;
		let volumeResetChapter: boolean = false;
		const volumeChapterCount: { [key: number]: number } = {};
		this.reverseChapters = {};
		for (const chapter of details._chapters) {
			const chapterDetails = {
				id: chapter.id,
				title: chapter.title,
				chapter: chapter.chapter,
				volume: chapter.volume,
				status: chapter.status,
				progress: this.chapterProgress(chapter),
			};
			this.reverseChapters[chapter.id] = chapterDetails;
			// Always check for volumeChapterCount while reading to update the chapter count
			//  since chapters are always available unlike the Title page.
			if (lastVolume >= 0) {
				const currentVolume = chapterDetails.progress.volume;
				// If there is no volume, volumes can't reset chapters
				if (currentVolume) {
					if (currentVolume != lastVolume) {
						lastVolume = currentVolume;
						// Check if volumes actually reset chapter or abort
						if (currentVolume > 1 && chapterDetails.progress.chapter <= 1) {
							volumeResetChapter = true;
						} else if (currentVolume > 1) lastVolume = -1;
					}
					// Avoid adding sub chapters
					if (
						chapterDetails.progress.chapter >= 1 &&
						Math.floor(chapterDetails.progress.chapter) == chapterDetails.progress.chapter
					) {
						if (volumeChapterCount[currentVolume]) {
							volumeChapterCount[currentVolume]++;
						} else volumeChapterCount[currentVolume] = 1;
					}
				} else lastVolume = -1;
			}
		}
		if (volumeResetChapter) {
			this.title.volumeChapterCount = volumeChapterCount;
			this.title.volumeResetChapter = true;
			this.updateReverseChapters();
			this.overview.addVolumeResetChapters();
		}
		this.loading.inProgress = false;
		this.loading.done = true;
		this.loading.state.resolve();
	}

	@TryCatch(Page.errorNotification)
	@LogExecTime
	async update(details: SimpleChapter): Promise<void> {
		if (!this.syncModule || !this.title) return;

		// Save State for *Cancel* button
		const previousState = this.syncModule.saveState();
		// Find current Chapter Progress
		const created = this.title.status == Status.NONE || this.title.status == Status.PLAN_TO_READ;
		let completed = false;
		const currentProgress = details.progress;
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
			await this.title.persist();
			if (this.firstRequest && Options.services.length > 0 && this.title.status !== Status.NONE) {
				const report = await this.syncModule.syncExternal();
				this.syncModule.displayReportNotifications(
					report,
					{ created, completed: false, firstRequest: this.firstRequest },
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
					const completed = this.title!.setProgress(currentProgress);
					await this.title!.persist();
					await this.syncShowResult(
						this.syncModule!,
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
				`**${this.title.name}** Chapter **${currentProgress.chapter}** is delayed or external and has not been updated.`
			);
		}
		// Check if the title is in list if required
		let mdListOptionValid = true;
		if (Options.updateOnlyInList) {
			if (!this.syncModule.loggedIn) {
				SimpleNotification.error({
					title: 'Not Logged In',
					text: `You are not logged in on **MangaDex** but you have the *Update Only in List** option enabled.\nDisable it or login on **MangaDex** !`,
				});
			}
			mdListOptionValid =
				this.syncModule.mdState.status !== undefined && this.syncModule.mdState.status !== Status.NONE;
			if (!mdListOptionValid && Options.confirmChapter) {
				missingUpdateValidations.push(
					`**${this.title.name}** is not your **MangaDex** List and wasn't updated.`
				);
			}
		}
		// Check if currentProgress should be updated and use setProgress if needed
		let doUpdate = mdListOptionValid && !delayed;
		if (doUpdate) {
			const isFirstChapter = this.title.chapter == 0 && currentProgress.chapter == 0;
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && (isFirstChapter || this.title.isNextChapter(currentProgress))) ||
				(Options.saveOnlyHigher &&
					!Options.saveOnlyNext &&
					(isFirstChapter || this.title.chapter < currentProgress.chapter))
			) {
				completed = this.title.setProgress(currentProgress); // Also update openedChapters
			} else if (Options.confirmChapter && (Options.saveOnlyNext || Options.saveOnlyHigher)) {
				doUpdate = false;
				missingUpdateValidations.push(
					`**${this.title.name}** Chapter **${currentProgress.chapter}** is not ${
						Options.saveOnlyNext ? 'the next' : 'higher'
					} and hasn't been updated.`
				);
			}
		}
		// If there is reasons to NOT update automatically to the current progress, display all reasons in a single Notification
		if (missingUpdateValidations.length > 0) {
			SimpleNotification.info({
				title: 'Not Updated',
				image: MangaDex.thumbnail(this.title.key, 'thumb'),
				text: missingUpdateValidations.join(`\n`),
				buttons: confirmButtons(),
			});
		}
		// Always Update History values if enabled, do not look at other options
		if (Options.biggerHistory) {
			await this.title.setHistory(details.id, currentProgress);
		}
		await this.title.persist(); // Always save

		// If all conditions are met we can sync to current progress
		if (doUpdate) {
			await this.syncShowResult(
				this.syncModule,
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
		else if (this.firstRequest && Options.services.length > 0) await this.syncModule.syncExternal();
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

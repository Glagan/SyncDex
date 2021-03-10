import { Page } from '../Page';
import { iconToService, LocalTitle, Title } from '../../Core/Title';
import { SyncModule } from '../../Core/SyncModule';
import { Options } from '../../Core/Options';
import { Mochi } from '../../Core/Mochi';
import { Services } from '../../Service/Class/Map';
import { Http } from '../../Core/Http';
import { MangaDex } from '../../Core/MangaDex';
import { injectScript, progressFromString } from '../../Core/Utility';
import { ActivableKey } from '../../Service/Keys';
import { DOM } from '../../Core/DOM';
import { TitleEditor } from '../../Core/TitleEditor';
import { LogExecTime, TryCatch } from '../../Core/Log';
import { Extension } from '../../Core/Extension';
import { UpdateQueue } from '../../Core/UpdateQueue';
import { listen } from '../../Core/Event';

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

class Overview {
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
		});
		this.rowContainer = DOM.create('div', {
			class: 'col-auto row no-gutters p-1',
			childs: [this.serviceRow],
		});
		const actionsRow = document.querySelector('.reader-controls-mode')!;
		actionsRow.parentElement!.insertBefore(this.rowContainer, actionsRow);
		this.reset();
	}

	reset() {
		DOM.clear(this.serviceRow);
		for (const key of Options.services) {
			this.icons[key] = DOM.create('img', {
				src: Extension.icon(key),
				title: Services[key].name,
			});
			this.icons[key]!.classList.add('loading');
			this.serviceRow.appendChild(this.icons[key]!);
		}
		this.serviceRow.appendChild(this.editButton);
	}

	bind(syncModule: SyncModule): void {
		// Add listeners
		listen('title:refresh', () => this.reset());
		listen('service:syncing', (payload) => {
			const icon = this.icons[payload.key];
			if (icon) icon.classList.add('loading');
		});
		listen('service:synced', (payload) => {
			const icon = this.icons[payload.key];
			if (icon) {
				icon.classList.remove('loading', 'error', 'synced', 'warning');
				if (!Options.iconsSilentAfterSync) {
					const res = payload.title;
					if (res === ServiceStatus.LOGGED_OUT) {
						icon.classList.add('error');
					} else if (res instanceof Title) {
						if (!res.loggedIn) {
							icon.classList.add('error');
						} else {
							icon.classList.add('synced');
						}
					} else icon.classList.add('warning');
				}
			}
		});
		// Title Editor
		this.editButton.addEventListener('click', async (event) => {
			event.preventDefault();
			TitleEditor.create(syncModule).show();
		});
	}

	updateIcon(icon: HTMLImageElement, res: Title | ResponseStatus): void {
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
	overview: Overview;
	firstRequest: boolean = true;
	reverseChapters: { [key: number]: SimpleChapter } = {};
	loading: {
		inProgress: boolean;
		done: boolean;
		state: { promise: () => Promise<any>; resolve: () => void };
	} = { state: initPromise(), done: false, inProgress: false };
	lastChecked: { id: number; page: number } = { id: 0, page: 0 };
	content: HTMLElement;
	queue: { id: number; page: number }[] = [];
	processingQueue: boolean = false;

	constructor() {
		super();
		this.content = document.getElementById('content') as HTMLElement;
		this.overview = new Overview();
	}

	@LogExecTime
	getMdUserTitle(id: number): Promise<JSONResponse<MangaDexUserTitleResponse>> {
		return Http.json<MangaDexUserTitleResponse>(MangaDex.api('get:user:title', id), {
			method: 'GET',
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
						chapter.progress.chapter += 0.5;
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
		// Generate reverse chapters and check if the Title reset chapter on each volumes
		let highestChapter = 0;
		let lastVolume: number = 0;
		let volumeResetChapter: boolean = false;
		let uniqueChapters: number[] = [];
		const volumeChapterCount: { [key: number]: number } = {};
		const volumeChapterOffset: { [key: number]: number } = {};
		this.reverseChapters = {};
		// Avoid counting sub chapters
		for (const chapter of details._chapters) {
			if (chapter.status == undefined) {
				chapter.status = typeof chapter.pages === 'string' ? 'external' : 'OK';
			}
			const chapterDetails = {
				id: chapter.id,
				title: chapter.title,
				chapter: chapter.chapter,
				volume: chapter.volume,
				status: chapter.status,
				progress: this.chapterProgress(chapter),
			};
			this.reverseChapters[chapter.id] = chapterDetails;
			const currentChapter = parseFloat(chapterDetails.chapter);
			if (currentChapter > highestChapter) {
				highestChapter = currentChapter;
			}
			// Always check for volumeChapterCount while reading to update the chapter count
			//  since chapters are always available unlike in the Title page.
			if (lastVolume >= 0) {
				const currentVolume = chapterDetails.progress.volume;
				// If there is no volume, volumes can't reset chapters
				if (currentVolume) {
					if (currentVolume != lastVolume) {
						lastVolume = currentVolume;
						// Check if volumes actually reset chapter or abort
						if (currentVolume > 1 && chapterDetails.progress.chapter <= 1) {
							volumeResetChapter = true;
							if (chapterDetails.progress.chapter == 1) {
								volumeChapterOffset[currentVolume] = 1;
							}
						} else if (currentVolume > 1) lastVolume = -1;
						uniqueChapters = [];
					}
					// Avoid adding sub chapters and duplicates
					if (
						uniqueChapters.indexOf(chapterDetails.progress.chapter) < 0 &&
						chapterDetails.progress.chapter >= 1 &&
						Math.floor(chapterDetails.progress.chapter) == chapterDetails.progress.chapter
					) {
						if (volumeChapterCount[currentVolume]) {
							volumeChapterCount[currentVolume]++;
						} else volumeChapterCount[currentVolume] = 1;
						uniqueChapters.push(chapterDetails.progress.chapter);
					}
				} else lastVolume = -1;
			}
		}
		// debug(`Volume reset chapters ? ${volumeResetChapter}`);
		if (volumeResetChapter) {
			/*debug(
				`Volume reset chapters.\nVolume chapter count: ${JSON.stringify(
					volumeChapterCount
				)}\nVolume offset: ${JSON.stringify(volumeChapterOffset)}`
			);*/
			this.title.volumeChapterCount = volumeChapterCount;
			this.title.volumeChapterOffset = volumeChapterOffset;
			this.title.volumeResetChapter = true;
			this.updateReverseChapters();
		}
		// Find max from MangaDex
		if (details.lastChapter) {
			const lastChapter = parseFloat(details.lastChapter);
			if (!isNaN(lastChapter) && lastChapter > 0) {
				const max: Progress = {
					chapter: parseFloat(details.lastChapter),
					volume: details.lastVolume ? parseInt(details.lastVolume) : undefined,
				};
				if (!this.title.volumeResetChapter) {
					this.title.max = max;
				}
			}
		}
		this.title.highest = highestChapter;
		await this.title.persist(); // Always save
		// Send initial requests
		this.syncModule = new SyncModule('chapter', this.title);
		this.overview.bind(this.syncModule);
		// Check if we're logged in on MangaDex
		this.syncModule.loggedIn = document.querySelector(`a.nav-link[href^='/user']`) !== null;
		this.syncModule.initialize();
		// Find MangaDex status if needed
		if (Options.updateOnlyInList || Options.updateMD) {
			const response = await this.getMdUserTitle(id);
			if (response.ok && response.body) {
				if (typeof response.body.data.followType === 'number') {
					this.syncModule.mdState.status = response.body.data.followType;
				}
				if (typeof response.body.data.rating === 'number') {
					this.syncModule.mdState.rating = response.body.data.rating * 10;
				}
				if (typeof response.body.data.chapter === 'string') {
					this.syncModule.mdState.progress.chapter = parseFloat(response.body.data.chapter);
					if (isNaN(this.syncModule.mdState.progress.chapter)) this.syncModule.mdState.progress.chapter = 0;
				}
				if (typeof response.body.data.volume === 'string') {
					this.syncModule.mdState.progress.volume = parseInt(response.body.data.volume);
					if (isNaN(this.syncModule.mdState.progress.volume)) this.syncModule.mdState.progress.volume = 0;
				}
			} // 403 Error is expected if not logged in
			else if (response.code >= 500) {
				SimpleNotification.error(
					{
						text: `Error while getting **MangaDex** Status.\ncode: __gn-badge t-error:**${response.code}**__`,
					},
					{ duration: Options.errorDuration }
				);
			}
		}
		// Check initial Status if it's the first time
		if (Options.services.length > 0) {
			await this.syncModule.import();
		}
		if (volumeResetChapter) {
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
		const currentProgress = details.progress;

		// Exit early if there is no progress
		if (isNaN(currentProgress.chapter)) {
			if (Options.errorNotifications) {
				SimpleNotification.error(
					{ title: 'No Chapter found', text: 'No Chapter could be found and no progress was saved.' },
					{ duration: Options.errorDuration }
				);
			}
			// Execute basic first request sync if needed before leaving
			// Only sync if Title has a Status to be synced to
			if (this.firstRequest && Options.services.length > 0 && this.title.status !== Status.NONE) {
				await this.syncModule.export();
			}
			return;
		}

		// Collect all warnings and reasons to not update to the current Chapter
		const reasons: string[] = [];
		// Update title state if not delayed -- Handle external titles as delayed
		const unavailable = details.status == 'delayed' || details.status == 'external';
		if (unavailable && Options.confirmChapter) {
			reasons.push(
				`**${this.title.name}** Chapter **${currentProgress.chapter}** is delayed or external and has not been updated.`
			);
		}
		// Check if the title is in list if required
		let mdListOptionValid = true;
		if (Options.updateOnlyInList) {
			if (!this.syncModule.loggedIn) {
				SimpleNotification.error(
					{
						title: 'Not Logged In',
						text: `You are not logged in on **MangaDex** but you have the *Update Only in List** option enabled.\nDisable it or login on **MangaDex** !`,
					},
					{ duration: Options.errorDuration }
				);
			}
			mdListOptionValid =
				this.syncModule.mdState.status !== undefined && this.syncModule.mdState.status !== Status.NONE;
			if (!mdListOptionValid && Options.confirmChapter) {
				reasons.push(`**${this.title.name}** is not your **MangaDex** List and wasn't updated.`);
			}
		}
		// Check if currentProgress should be updated and use setProgress if needed
		let doUpdate = mdListOptionValid && !unavailable;
		if (doUpdate) {
			const isFirstChapter = this.title.chapter == 0 && currentProgress.chapter == 0;
			if (
				(!Options.saveOnlyNext && !Options.saveOnlyHigher) ||
				(Options.saveOnlyNext && (isFirstChapter || this.title.isNextChapter(currentProgress))) ||
				(Options.saveOnlyHigher &&
					!Options.saveOnlyNext &&
					(isFirstChapter || this.title.chapter < currentProgress.chapter))
			) {
				await this.syncModule.syncProgress(currentProgress);
			} else if (Options.confirmChapter && (Options.saveOnlyNext || Options.saveOnlyHigher)) {
				reasons.push(
					`**${this.title.name}** Chapter **${currentProgress.chapter}** is not ${
						Options.saveOnlyNext ? 'the next' : 'higher'
					} and hasn't been updated.`
				);
				doUpdate = false;
				UpdateQueue.confirm(this.syncModule, currentProgress, reasons);
			}
		} else {
			UpdateQueue.confirm(this.syncModule, currentProgress, reasons);
		}
		// Always Update History values if enabled, do not look at other options
		if (Options.biggerHistory) {
			await this.title.setHistory(details.id, currentProgress);
			await this.title.persist();
		}

		// If we do not need to update, we still sync to the current non updated progress but no output
		if (!doUpdate && this.firstRequest && Options.services.length > 0) {
			await this.syncModule.export();
		}
		this.firstRequest = false;
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
			UpdateQueue.noServices();
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
		const lastChange = { id: 0, page: 0 };
		const addAndProcessQueue = (id: number, page: number) => {
			if (lastChange.id != id || lastChange.page != page) {
				this.queue.push({ id, page });
				if (!this.processingQueue) {
					this.processQueue();
				}
			}
			lastChange.id = id;
			lastChange.page = page;
		};
		document.addEventListener('ReaderChapterChange', (event) => {
			const details = (event as CustomEvent<ChapterChangeDetails>).detail;
			// Update reverse chapter details
			if (details.status == undefined) {
				details.status = typeof details.pages === 'string' ? 'external' : 'OK';
			}
			this.reverseChapters[details.id] = {
				id: details.id,
				title: details.title,
				chapter: details.chapter,
				volume: details.volume,
				status: details.status,
				progress: this.chapterProgress(details),
			};
			// Process queue directly for external chapters, no ReaderPageChange trigerred
			if (details.status == 'external' || details.status == 'delayed') {
				const id = parseInt(this.content.dataset.chapterId!);
				const page = Infinity;
				addAndProcessQueue(id, page);
			}
		});
		document.addEventListener('ReaderPageChange', async (event) => {
			const id = parseInt(this.content.dataset.chapterId!);
			const page = (event as CustomEvent<number>).detail;
			addAndProcessQueue(id, page);
		});
	}
}

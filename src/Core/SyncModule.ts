import { Title } from './Title';
import { Options } from './Options';
import { Request } from './Request';
import { Services } from '../Service/Class/Map';
import { log, LogExecTime } from './Log';
import { ActivableKey } from '../Service/Keys';
import { LocalTitle } from './Title';
import { MangaDex } from './MangaDex';
import { dispatch } from './Event';

export class SyncModule {
	title: LocalTitle;
	loadingServices: Promise<Title | RequestStatus>[] = [];
	services: { [key in ActivableKey]?: Title | RequestStatus } = {};
	// Logged in on MangaDex
	loggedIn: boolean = true;
	// MangaDex Status and Score
	previousIsSubChapter: boolean = false;
	previousMdState?: MangaDexState;
	mdState: MangaDexState = {
		status: Status.NONE,
		rating: 0,
		progress: { chapter: 0, volume: 0 },
	};
	origin: 'options' | 'title' | 'list' | 'chapter';

	constructor(origin: 'options' | 'title' | 'list' | 'chapter', title: LocalTitle) {
		this.origin = origin;
		this.title = title;
	}

	initializeService(key: ActivableKey): void {
		dispatch('service:syncing', { key: key });
		const initialRequest = Services[key].get(this.title.services[key]!);
		this.loadingServices.push(initialRequest);
		initialRequest.then((res) => {
			this.services[key] = res;
			dispatch('service:synced', { key, title: res, local: this.title });
			return res;
		});
	}

	/**
	 * Send initial Media requests concurrently for each services.
	 */
	initialize(): void {
		dispatch('sync:initialize:start');
		this.services = {}; // Reset services
		if (Options.services.length == 0) {
			return dispatch('sync:initialize:end', { title: this.title });
		}
		const activeServices = Object.keys(this.title.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		// Add Services ordered by Options.services to check Main Service first
		for (const key of Options.services) {
			const hasId = activeServices.indexOf(key) >= 0;
			if (hasId) this.initializeService(key);
			else dispatch('service:synced', { key, title: false, local: this.title });
		}
	}

	async waitInitialize(): Promise<void> {
		if (this.loadingServices.length > 0) {
			await Promise.all(this.loadingServices);
			this.loadingServices = [];
			// Find pepper
			for (const key in this.services) {
				const response = this.services[key as ActivableKey];
				if (response instanceof Title && response.max) {
					if (!this.title.max) {
						this.title.max = { chapter: undefined, volume: undefined };
					}
					const chapter = response.max.chapter;
					if (!this.title.max.chapter || (chapter && chapter < this.title.max.chapter)) {
						this.title.max.chapter = chapter;
					}
					const volume = response.max.volume;
					if (!this.title.max.volume || (volume && volume < this.title.max.volume)) {
						this.title.max.volume = volume;
					}
				}
			}
			dispatch('sync:initialize:end', { title: this.title });
		}
	}

	@LogExecTime
	async refresh() {
		dispatch('title:refresh', { syncModule: this });
		await this.title.refresh();
		this.initialize();
		await this.syncLocal();
		await this.syncExternal(true);
	}

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	@LogExecTime
	async syncLocal(): Promise<boolean> {
		dispatch('title:syncing');
		await this.waitInitialize();
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		let doSave = false;
		for (const key of [...Options.services].reverse()) {
			if (this.services[key] === undefined) continue;
			const response = this.services[key];
			if (response instanceof Title && response.loggedIn) {
				// Check if any of the ServiceTitle is more recent than the local Title
				if (response.inList && (this.title.inList || response.isMoreRecent(this.title))) {
					// If there is one, sync with it and save
					this.title.inList = false;
					this.title.merge(response);
					doSave = true;
				}
				// Finish retrieving the ID if required -- AnimePlanet has 2 fields
				if (Services[key].updateKeyOnFirstFetch && !this.title.doForceService(key)) {
					this.title.services[key] = response.key;
					doSave = true;
				}
			}
		}
		if (doSave) await this.title.persist();
		dispatch('title:synced', { title: this.title });
		return doSave;
	}

	/**
	 * Update the status of the instance LocalTitle and all external services.
	 */
	@LogExecTime
	async syncStatus(status: Status): Promise<void> {
		dispatch('sync:start', { title: this.title });
		const state = this.saveState();
		this.title.status = status;
		if (status == Status.READING && !this.title.start) {
			this.title.start = new Date();
		} else if (status == Status.COMPLETED) {
			if (!this.title.start) this.title.start = new Date();
			if (!this.title.end) this.title.end = new Date();
		}
		await this.title.persist();
		const report = await this.syncExternal();
		dispatch('sync:end', { type: 'status', state, report, syncModule: this });
	}

	/**
	 * Update the progress of the instance LocalTitle and all external services.
	 */
	@LogExecTime
	async syncProgress(progress: Progress): Promise<void> {
		dispatch('sync:start', { title: this.title });
		const state = this.saveState();
		const result = this.title.setProgress(progress);
		if (Options.saveOpenedChapters) {
			this.title.addChapter(progress.chapter);
		}
		await this.title.persist();
		const report = await this.syncExternal();
		dispatch('sync:end', { type: 'progress', state, result, report, syncModule: this });
	}

	/**
	 * Update the score of the instance LocalTitle and all external services.
	 */
	@LogExecTime
	async syncScore(score: number): Promise<void> {
		dispatch('sync:start', { title: this.title });
		const state = this.saveState();
		this.title.score = score;
		await this.title.persist();
		const report = await this.syncExternal();
		dispatch('sync:end', { type: 'score', state, report, syncModule: this });
	}

	/**
	 * Sync all Services with the local SyncDex Title, or delete them if needed.
	 * Also sync MangaDex if Options.updateMD is enabled, also deleting the follow if needed.
	 */
	@LogExecTime
	async syncExternal(checkAutoSyncOption: boolean = false): Promise<SyncReport> {
		await this.waitInitialize();

		const promises: Promise<RequestStatus>[] = [];
		const report: SyncReport = {};
		for (const key of Options.services) {
			const title = this.services[key];
			if (title === undefined) continue;
			if (!(title instanceof Title)) {
				report[key] = title;
				continue;
			} else if (!title.loggedIn) {
				report[key] = false;
				continue;
			}
			const synced = title.isSyncedWith(this.title);
			// If Auto Sync is on, import from now up to date Title and persist
			if ((!checkAutoSyncOption || Options.autoSync) && !synced) {
				title.import(this.title);
				dispatch('service:syncing', { key: key });
				// ! To fix: An update without a status (score update only for example) try to delete, maybe ignore ?
				const promise = this.title.status == Status.NONE ? title.delete() : title.persist();
				promises.push(promise);
				promise
					.then((res) => {
						if (res > RequestStatus.DELETED) {
							dispatch('service:synced', { key, title: res, local: this.title });
						} else dispatch('service:synced', { key, title, local: this.title });
						report[key] = res;
					})
					.catch(async (error) => {
						dispatch('service:synced', { key, title: RequestStatus.FAIL, local: this.title });
						report[key] = false;
						await log(error);
					});
			}
			// Always update the overview to check against possible imported ServiceTitle
			else dispatch('service:synced', { key, title, local: this.title });
		}

		// Update MangaDex List Status and Score
		// Can't check loggedIn status since it can be called without MangaDex check first
		if (Options.updateMD && this.loggedIn) {
			const strings: { success: string[]; error: string[] } = { success: [], error: [] };
			// Status
			if (this.mdState.status != this.title.status) {
				const oldStatus = this.mdState.status;
				this.mdState.status = this.title.status;
				const response = await this.syncMangaDex(this.mdState.status == Status.NONE ? 'unfollow' : 'status');
				if (response.ok && (!response.body || response.body.length == 0)) {
					strings.success.push('**MangaDex Status** updated.');
				} else {
					this.mdState.status = oldStatus;
					strings.error.push(`Error while updating **MangaDex Status**.\ncode: ${response.code}`);
				}
			}
			// Score
			if (
				this.loggedIn &&
				this.title.score > 0 &&
				Math.round(this.mdState.rating / 10) != Math.round(this.title.score / 10)
			) {
				// Convert 0-100 SyncDex Score to 0-10
				const oldScore = this.mdState.rating;
				this.mdState.rating = this.title.score;
				const response = await this.syncMangaDex('rating');
				if (response.ok) strings.success.push('**MangaDex Score** updated.');
				else {
					this.mdState.rating = oldScore;
					strings.error.push(`Error while updating **MangaDex Score**.\ncode: ${response.code}`);
				}
			}
			// Progress
			// Update on Chapter Page if it's a sub chapter, since MD don't save them
			//	OR if the previous read chapter was a subchapter to fix a MD bug with sub chapters in MD Progress
			const isSubChapter = Math.floor(this.title.chapter) != this.title.chapter;
			if (
				this.loggedIn &&
				Options.updateMDProgress &&
				(this.origin != 'chapter' ||
					isSubChapter ||
					this.previousIsSubChapter ||
					Math.floor(this.mdState.progress.chapter) != this.mdState.progress.chapter) &&
				(this.title.chapter != this.mdState.progress.chapter ||
					(this.title.volume != undefined && this.title.volume != this.mdState.progress.volume))
			) {
				const oldProgress = this.mdState.progress;
				this.mdState.progress = { ...this.title.progress };
				if (!this.mdState.progress.volume) this.mdState.progress.volume = 0;
				const response = await this.syncMangaDex('progress');
				if (response.ok) strings.success.push('**MangaDex Progress** updated.');
				else {
					this.mdState.progress = oldProgress;
					strings.error.push(`Error while updating **MangaDex Progress**.\ncode: ${response.code}`);
				}
			}
			this.previousIsSubChapter = isSubChapter;
			if (strings.success.length > 0) {
				SimpleNotification.success({ text: strings.success.join('\n') }, { duration: Options.successDuration });
			}
			if (strings.error.length > 0) {
				SimpleNotification.error({ text: strings.error.join('\n') }, { duration: Options.errorDuration });
			}
		}
		await Promise.all(promises);
		return report;
	}

	/**
	 * Restore state for the instance LocalTitle and update all external Services.
	 */
	@LogExecTime
	async cancel(state: LocalTitleState): Promise<void> {
		dispatch('sync:start', { title: this.title });
		this.restoreState(state);
		await this.title.persist();
		await this.syncExternal();
		dispatch('sync:end', { type: 'cancel', syncModule: this });
	}

	/**
	 * Sync MangaDex Status or Rating.
	 */
	@LogExecTime
	private async syncMangaDex(field: MangaDexTitleField): Promise<RequestResponse> {
		dispatch('mangadex:syncing', { field });
		let response: RawResponse;
		if (field == 'progress') {
			response = await Request.get({
				method: 'POST',
				url: MangaDex.list(field, this.title.key.id!, this.mdState),
				credentials: 'include',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				form: {
					volume: this.mdState.progress.volume ?? 0,
					chapter: this.mdState.progress.chapter,
				},
			});
		} else {
			response = await Request.get({
				method: 'GET',
				url: MangaDex.list(field, this.title.key.id!, this.mdState),
				credentials: 'include',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
			});
		}
		dispatch('mangadex:synced', { field, state: this.mdState });
		return response;
	}

	@LogExecTime
	async syncMangaDexStatus(status: Status): Promise<boolean> {
		const oldStatus = this.mdState.status;
		this.mdState.status = status;
		const response = await this.syncMangaDex(this.mdState.status == Status.NONE ? 'unfollow' : 'status');
		// Status update returns a body on error
		if (!response.ok || (response.body && response.body.length > 0)) {
			this.mdState.status = oldStatus;
		}
		return response.ok;
	}

	@LogExecTime
	async syncMangaDexProgress(progress: Progress): Promise<boolean> {
		const oldProgress = this.mdState.progress;
		this.mdState.progress = { ...progress };
		if (!this.mdState.progress.volume) this.mdState.progress.volume = 0;
		const response = await this.syncMangaDex('progress');
		if (!response.ok) {
			this.mdState.progress = oldProgress;
		}
		return response.ok;
	}

	@LogExecTime
	async syncMangaDexRating(rating: number): Promise<boolean> {
		if (this.mdState.rating === rating) return true;
		const oldRating = this.mdState.rating;
		this.mdState.rating = rating;
		const response = await this.syncMangaDex('rating');
		if (!response.ok) {
			this.mdState.rating = oldRating;
		}
		return response.ok;
	}

	/**
	 * Save a copy of the current Title to be able to restore some of it's value if the *Cancel* button is clicked
	 * 	in the this.displayReportNotifications function.
	 */
	saveState(): LocalTitleState {
		this.previousMdState = {
			status: this.mdState.status,
			rating: this.mdState.rating,
			progress: { ...this.mdState.progress },
		};
		return JSON.parse(JSON.stringify(this.title)); // Deep copy
	}

	/**
	 * Restore chapters, mdStatus, mdScore, lastChapter, lastRead,
	 * 	inList, status, progress, score, start, end from previousState.
	 */
	restoreState(title: LocalTitleState): void {
		if (this.previousMdState) {
			this.mdState.status = this.previousMdState.status;
			this.mdState.rating = this.previousMdState.rating;
		}
		this.title.inList = title.inList;
		this.title.progress = title.progress;
		this.title.chapters = title.chapters;
		this.title.status = title.status;
		this.title.score = title.score;
		this.title.name = title.name;
		this.title.lastChapter = title.lastChapter;
		this.title.lastRead = title.lastRead;
		this.title.history = title.history;
		// Add back Date objects since JSON.stringify made them strings
		this.title.start = title.start ? new Date(title.start) : undefined;
		this.title.end = title.end ? new Date(title.end) : undefined;
	}

	async refreshService(key: ActivableKey): Promise<void> {
		if (!this.title.services[key]) return;
		const res = await Services[key].get(this.title.services[key]!);
		this.services[key] = res;
		await this.syncLocal();
		await this.syncExternal(true);
	}

	async serviceImport(key: ActivableKey): Promise<void> {
		const title = this.services[key];
		if (!title || typeof title === 'number') return;
		dispatch('service:syncing', { key });
		title.import(this.title);
		const res = await title.persist();
		if (res > RequestStatus.CREATED) {
			dispatch('service:synced', { key, title: res, local: this.title });
		} else dispatch('service:synced', { key, title, local: this.title });
	}
}

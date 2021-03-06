import { Title } from './Title';
import { Options } from './Options';
import { Http } from './Http';
import { Services } from '../Service/Class/Map';
import { log, LogExecTime } from './Log';
import { ActivableKey } from '../Service/Keys';
import { LocalTitle } from './Title';
import { MangaDex } from './MangaDex';
import { dispatch } from './Event';

export class SyncModule {
	title: LocalTitle;
	loadingServices: Promise<Title | ServiceResponse>[] = [];
	services: { [key in ActivableKey]?: Title | ServiceResponse } = {};
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
		if (this.title.services[key]) {
			const initialRequest = Services[key].get(this.title.services[key]!);
			this.loadingServices.push(initialRequest);
			initialRequest
				.then((res) => {
					this.services[key] = res;
					dispatch('service:synced', { key, title: res, local: this.title });
					return res;
				})
				.catch((error) => {
					log(error);
					this.services[key] = ResponseStatus.FAIL;
					dispatch('service:synced', { key, title: ResponseStatus.FAIL, local: this.title });
					return ResponseStatus.FAIL;
				});
		} else {
			this.services[key] = ServiceStatus.NO_ID;
			dispatch('service:synced', { key, title: ServiceStatus.NO_ID, local: this.title });
		}
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
		// Add Services ordered by Options.services to check Main Service first
		for (const key of Options.services) {
			this.initializeService(key);
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
		}
		dispatch('sync:initialize:end', { title: this.title });
	}

	@LogExecTime
	async refresh() {
		dispatch('title:refresh', { syncModule: this });
		await this.title.refresh();
		this.initialize();
		await this.import();
		await this.export();
	}

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	@LogExecTime
	async import(): Promise<boolean> {
		await this.waitInitialize();
		dispatch('title:syncing');
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
	async syncAll(title: TitleEditorState, options: { deleteOld: boolean; updateExternals: boolean }): Promise<void> {
		dispatch('sync:start', { title: this.title });
		const state = this.saveState();
		this.title.status = title.status;
		this.title.name = title.name;
		this.title.progress = title.progress;
		this.title.score = title.score;
		this.title.start = title.start;
		this.title.end = title.end;
		this.title.chapters = title.chapters;
		// Services
		const updatedIDs: { key: ActivableKey; from?: MediaKey; to?: MediaKey }[] = [];
		for (const key of Object.values(ActivableKey)) {
			// Update or delete
			if (title.services[key].found) {
				if (
					!this.title.services[key] ||
					!Services[key].compareId(this.title.services[key]!, title.services[key].mediaKey)
				) {
					updatedIDs.push({ key, from: this.title.services[key], to: title.services[key].mediaKey });
					this.title.services[key] = title.services[key].mediaKey;
				}
			} else if (this.title.services[key]) {
				updatedIDs.push({ key, from: this.title.services[key], to: undefined });
				delete this.title.services[key];
			}
			// Update forced
			if (title.services[key].forced) {
				this.title.addForceService(key);
			} else this.title.removeForceService(key);
		}
		await this.title.persist();
		// Remove old externals and initialize new ones
		if (options.deleteOld || options.updateExternals) {
			dispatch('title:refresh', { syncModule: this });
		}
		const deleteReport: SyncReport | undefined = options.deleteOld ? {} : undefined;
		await this.waitInitialize();
		const deletePromises: Promise<ResponseStatus>[] = [];
		for (const update of updatedIDs) {
			const key = update.key;
			if (Options.services.indexOf(key) >= 0) {
				// Remove old services
				if (update.from && typeof this.services[key] === 'object') {
					if (options.deleteOld) {
						const promise = (this.services[key] as Title).delete();
						deletePromises.push(promise);
						promise
							.then((res) => {
								dispatch('service:synced', { key, title: res, local: this.title });
								return res;
							})
							.catch(async (error) => {
								dispatch('service:synced', { key, title: ResponseStatus.FAIL, local: this.title });
								await log(error);
								throw error;
							});
					}
					delete this.services[key];
				}
				// Initialize new Service
				if (update.to) {
					this.initializeService(key);
				}
			}
		}
		await Promise.all(deletePromises);
		// Export
		await this.waitInitialize();
		if (!options.updateExternals) {
			// Dispatch service:synced to update with difference if updateExternals is disabled
			const { report, mdReport } = { report: undefined, mdReport: undefined };
			for (const key of Options.services) {
				dispatch('service:synced', {
					key,
					title: this.services[key] ?? ServiceStatus.NO_ID,
					local: this.title,
				});
			}
			dispatch('sync:end', { type: 'edit', state, deleteReport, report, mdReport, updatedIDs, syncModule: this });
		} else {
			const { report, mdReport } = await this.export();
			dispatch('sync:end', { type: 'edit', state, deleteReport, report, mdReport, updatedIDs, syncModule: this });
		}
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
		const { report } = await this.export(false);
		const mdReport: MDListReport = {};
		if (Options.updateMD) {
			mdReport.status = await this.syncMangaDexStatus(status);
		}
		dispatch('sync:end', { type: 'status', state, report, mdReport, syncModule: this });
	}

	/**
	 * Update the progress of the instance LocalTitle and all external services.
	 */
	@LogExecTime
	async syncProgress(progress: Progress): Promise<void> {
		dispatch('sync:start', { title: this.title });
		const state = this.saveState();
		if (!progress.volume) progress.volume = this.title.volume;
		const result = this.title.setProgress({ ...progress });
		if (Options.saveOpenedChapters) {
			this.title.addChapter(progress.chapter);
		}
		await this.title.persist();
		const { report } = await this.export(false);
		const mdReport: MDListReport = {};
		if (Options.updateMD && Options.updateMDProgress) {
			mdReport.progress = await this.syncMangaDexProgress(progress);
		}
		dispatch('sync:end', { type: 'progress', state, result, report, mdReport, syncModule: this });
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
		const { report } = await this.export(false);
		const mdReport: MDListReport = {};
		if (Options.updateMD) {
			mdReport.rating = await this.syncMangaDexRating(score);
		}
		dispatch('sync:end', { type: 'score', state, report, mdReport, syncModule: this });
	}

	/**
	 * Import the Local Instance title on the external service identified by key.
	 * Returns RequestStatus on request sent, false if the title has no ID or is not logged in.
	 * @param key The Service key
	 */
	async exportService(key: ActivableKey): Promise<ServiceResponse> {
		const title = this.services[key];
		// If the title is "invalid" still send a service:synced to update the interface
		if (title === undefined) {
			dispatch('service:synced', { key, title: ServiceStatus.NO_ID, local: this.title });
			return ServiceStatus.NO_ID;
		} else if (typeof title === 'object' && !title.loggedIn) {
			dispatch('service:synced', { key, title: ServiceStatus.LOGGED_OUT, local: this.title });
			return ServiceStatus.LOGGED_OUT;
		} else if (typeof title !== 'object') {
			dispatch('service:synced', { key, title, local: this.title });
			return title;
		}

		const synced = title.isSyncedWith(this.title);
		if (!synced) {
			dispatch('service:syncing', { key: key });
			const previousStatus = title.status;
			title.import(this.title);
			// Only update if the status is not null (update) OR if it wasn't null (delete)
			if (title.status != Status.NONE || previousStatus != Status.NONE) {
				const promise = title.status == Status.NONE ? title.delete() : title.persist();
				return promise
					.then((res) => {
						if (res > ResponseStatus.DELETED) {
							dispatch('service:synced', { key, title: res, local: this.title });
						} else dispatch('service:synced', { key, title, local: this.title });
						return res;
					})
					.catch(async (error) => {
						dispatch('service:synced', { key, title: ResponseStatus.FAIL, local: this.title });
						await log(error);
						throw error;
					});
			}
		}
		// Always update the overview to check against possible imported ServiceTitle
		dispatch('service:synced', { key, title, local: this.title });
		return ServiceStatus.SYNCED;
	}

	/**
	 * Sync all Services with the local SyncDex Title, or delete them if needed.
	 * Also sync MangaDex if Options.updateMD is enabled, also deleting the follow if needed.
	 */
	async export(exportMangaDex?: true): Promise<{ report: SyncReport; mdReport: MDListReport }>;
	async export(exportMangaDex?: false): Promise<{ report: SyncReport }>;
	@LogExecTime
	async export(
		exportMangaDex: boolean = true
	): Promise<{ report: SyncReport; mdReport: MDListReport } | { report: SyncReport }> {
		await this.waitInitialize();

		const promises: Promise<ServiceResponse | undefined>[] = [];
		const report: SyncReport = {};
		for (const key of Options.services) {
			const promise = this.exportService(key);
			promises.push(promise);
			promise.then((result) => (report[key] = result)).catch(() => (report[key] = ResponseStatus.FAIL));
		}

		// Update MangaDex List Status, Score and Progress
		// Can't check loggedIn status since it can be called without MangaDex check first
		let mdReport: MDListReport | undefined;
		if (exportMangaDex && Options.updateMD && this.loggedIn) {
			mdReport = {};
			mdReport.status = await this.syncMangaDexStatus(this.title.status);
			mdReport.rating = await this.syncMangaDexRating(this.title.score);
			if (Options.updateMDProgress) {
				mdReport.progress = await this.syncMangaDexProgress(this.title.progress);
			}
		}
		await Promise.all(promises);
		return { report, mdReport };
	}

	/**
	 * Restore state for the instance LocalTitle and update all external Services.
	 */
	@LogExecTime
	async cancel(state: LocalTitleState): Promise<void> {
		dispatch('sync:start', { title: this.title });
		// TODO: Save and restore services ?
		this.restoreState(state);
		await this.title.persist();
		await this.export();
		dispatch('sync:end', { type: 'cancel', syncModule: this });
	}

	/**
	 * Sync MangaDex Status or Rating.
	 */
	@LogExecTime
	private async syncMangaDex(field: MangaDexTitleField): Promise<RawResponse> {
		dispatch('mangadex:syncing', { title: this.title, field });
		let response: RawResponse;
		if (field == 'progress') {
			response = await Http.post(MangaDex.list(field, this.title.key.id!, this.mdState), {
				credentials: 'include',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				form: {
					volume: this.mdState.progress.volume ?? 0,
					chapter: this.mdState.progress.chapter,
				},
			});
		} else {
			response = await Http.get(MangaDex.list(field, this.title.key.id!, this.mdState), {
				credentials: 'include',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
			});
		}
		// MangaDex fails with a body on error
		if (field !== 'rating' && response.body && response.body.length > 0) {
			response.ok = false;
			response.status = ResponseStatus.UNAUTHORIZED;
		}
		const { status } = response;
		dispatch('mangadex:synced', { title: this.title, field, status, state: this.mdState });
		return response;
	}

	@LogExecTime
	async syncMangaDexStatus(status: Status): Promise<ResponseStatus> {
		if (!this.loggedIn) return ResponseStatus.UNAUTHORIZED;
		if (this.mdState.status === status) return ResponseStatus.SUCCESS;
		const oldStatus = this.mdState.status;
		this.mdState.status = status;
		const response = await this.syncMangaDex(this.mdState.status == Status.NONE ? 'unfollow' : 'status');
		if (!response.ok) {
			this.mdState.status = oldStatus;
		}
		return response.status;
	}

	@LogExecTime
	async syncMangaDexProgress(progress: Progress): Promise<ResponseStatus> {
		if (!this.loggedIn) return ResponseStatus.UNAUTHORIZED;
		const isSubChapter = Math.floor(progress.chapter) != progress.chapter;
		if (
			// ? Always sync, MangaDex sometimes (?) doesn't do it
			/*(this.origin != 'chapter' ||
				isSubChapter ||
				this.previousIsSubChapter ||
				Math.floor(this.mdState.progress.chapter) != this.mdState.progress.chapter) &&*/
			progress.chapter != this.mdState.progress.chapter ||
			// undefined if already "synced" with 0
			(progress.volume != undefined && progress.volume !== this.mdState.progress.volume)
		) {
			const oldProgress = this.mdState.progress;
			this.mdState.progress = { ...progress };
			if (!this.mdState.progress.volume) this.mdState.progress.volume = 0;
			const response = await this.syncMangaDex('progress');
			if (!response.ok) {
				this.mdState.progress = oldProgress;
			} else this.previousIsSubChapter = isSubChapter;
			return response.status;
		}
		return ResponseStatus.SUCCESS;
	}

	/**
	 * Update on Chapter Page if it's a sub chapter, since MD don't save them
	 * 	OR if the previous read chapter was a subchapter to fix a MD bug with sub chapters in MD Progress
	 */
	@LogExecTime
	async syncMangaDexRating(rating: number): Promise<ResponseStatus> {
		if (!this.loggedIn) return ResponseStatus.UNAUTHORIZED;
		if (Math.round(this.mdState.rating / 10) === Math.round(rating / 10)) {
			return ResponseStatus.SUCCESS;
		}
		const oldRating = this.mdState.rating;
		this.mdState.rating = rating;
		const response = await this.syncMangaDex('rating');
		if (!response.ok) {
			this.mdState.rating = oldRating;
		}
		return response.status;
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
		await this.import();
		await this.export();
	}

	async serviceImport(key: ActivableKey): Promise<void> {
		const title = this.services[key];
		if (!title || typeof title === 'number') return;
		dispatch('service:syncing', { key });
		title.import(this.title);
		const res = await title.persist();
		if (res > ResponseStatus.CREATED) {
			dispatch('service:synced', { key, title: res, local: this.title });
		} else dispatch('service:synced', { key, title, local: this.title });
	}

	async delete(): Promise<void> {
		dispatch('sync:start', { title: this.title });
		const state = this.saveState();
		this.title.delete();
		await this.title.persist();
		const { report, mdReport } = await this.export();
		dispatch('sync:end', { type: 'delete', state, report, mdReport, syncModule: this });
	}
}

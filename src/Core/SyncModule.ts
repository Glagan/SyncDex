import { Title, StatusMap } from './Title';
import { Options } from './Options';
import { Runtime } from './Runtime';
import { Overview } from '../SyncDex/Overview';
import { Services } from '../Service/Class/Map';
import { log } from './Log';
import { ActivableKey, StaticKey } from '../Service/Keys';
import { LocalTitle } from './Title';
import { MangaDex } from './MangaDex';

export type SyncReport = {
	[key in ActivableKey]?: RequestStatus | false;
};

export interface ReportInformations {
	created?: boolean;
	completed: boolean;
	firstRequest?: boolean;
	localUpdated?: boolean;
}

interface MangaDexState {
	status: Status;
	score: number;
}

export class SyncModule {
	title: LocalTitle;
	overview?: Overview;
	loadingServices: Promise<Title | RequestStatus>[] = [];
	services: { [key in ActivableKey]?: Title | RequestStatus } = {};
	// Logged in on MangaDex
	loggedIn: boolean = true;
	// MangaDex Status and Score
	previousMdState?: MangaDexState;
	mdState: MangaDexState = {
		status: Status.NONE,
		score: 0,
	};

	constructor(title: LocalTitle, overview?: Overview) {
		this.title = title;
		this.overview = overview;
		if (this.overview?.bind) this.overview.bind(this);
	}

	/**
	 * Send initial Media requests concurrently for each services.
	 */
	initialize = (): void => {
		this.services = {}; // Reset services
		if (Options.services.length == 0) {
			this.overview?.hasNoServices();
			return;
		}
		const activeServices = Object.keys(this.title.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		// Add Services ordered by Options.services to check Main Service first
		for (const key of Options.services) {
			const hasId = activeServices.indexOf(key) >= 0;
			this.overview?.initializeService(key, hasId);
			if (hasId) {
				const initialRequest = Services[key].get(this.title.services[key]!);
				this.loadingServices.push(initialRequest);
				initialRequest.then((res) => {
					this.overview?.receivedInitialRequest(key, res, this);
					this.services[key] = res;
					return res;
				});
			}
		}
	};

	waitInitialize = async (): Promise<void> => {
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
			if (this.overview?.receivedAllInitialRequests) this.overview.receivedAllInitialRequests(this);
		}
	};

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	syncLocal = async (): Promise<boolean> => {
		await this.waitInitialize();
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		this.overview?.syncingLocal();
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
				if (Services[key].updateKeyOnFirstFetch) {
					this.title.services[key] = response.key;
					doSave = true;
				}
			}
		}
		if (doSave) await this.title.persist();
		this.overview?.syncedLocal(this.title);
		return doSave;
	};

	/**
	 * Sync all Services with the local SyncDex Title, or delete them if needed.
	 * Also sync MangaDex if Options.updateMD is enabled, also deleting the follow if needed.
	 */
	syncExternal = async (checkAutoSyncOption: boolean = false): Promise<SyncReport> => {
		await this.waitInitialize();
		const promises: Promise<RequestStatus>[] = [];
		const report: SyncReport = {};
		for (const key of Options.services) {
			const service = this.services[key];
			if (service === undefined) continue;
			if (!(service instanceof Title)) {
				report[key] = service as RequestStatus;
				continue;
			}
			if (!service.loggedIn) {
				report[key] = false;
				continue;
			}
			const synced = service.isSyncedWith(this.title);
			// If Auto Sync is on, import from now up to date Title and persist
			if ((!checkAutoSyncOption || Options.autoSync) && !synced) {
				service.import(this.title);
				this.overview?.syncingService(key);
				const promise = this.title.status == Status.NONE ? service.delete() : service.persist();
				promises.push(promise);
				promise
					.then((res) => {
						if (res > RequestStatus.DELETED) {
							this.overview?.syncedService(key, res, this.title);
						} else this.overview?.syncedService(key, service, this.title);
						report[key] = res;
					})
					.catch(async (error) => {
						this.overview?.syncedService(key, RequestStatus.FAIL, this.title);
						report[key] = false;
						await log(error);
					});
				// Always update the overview to check against possible imported ServiceTitle
			} else this.overview?.syncedService(key, service, this.title);
		}
		// Update MangaDex List Status and Score
		// Can't check loggedIn status since it can be called without MangaDex check first
		if (Options.updateMD && this.loggedIn) {
			const strings: { success: string[]; error: string[] } = { success: [], error: [] };
			if (this.mdState.status != this.title.status) {
				const oldStatus = this.mdState.status;
				this.mdState.status = this.title.status;
				const response = await this.syncMangaDex(this.mdState.status == Status.NONE ? 'unfollow' : 'status');
				if (response.ok) strings.success.push('**MangaDex Status** updated.');
				else {
					this.mdState.status = oldStatus;
					strings.error.push(`Error while updating **MangaDex Status**.\ncode: ${response.code}`);
				}
			}
			if (
				this.loggedIn &&
				this.title.score > 0 &&
				Math.round(this.mdState.score / 10) != Math.round(this.title.score / 10)
			) {
				// Convert 0-100 SyncDex Score to 0-10
				const oldScore = this.mdState.score;
				this.mdState.score = this.title.score;
				const response = await this.syncMangaDex('score');
				if (response.ok) strings.success.push('**MangaDex Score** updated.');
				else {
					this.mdState.score = oldScore;
					strings.error.push(`Error while updating **MangaDex Score**.\ncode: ${response.code}`);
				}
			}
			if (strings.success.length > 0) {
				SimpleNotification.success({ text: strings.success.join('\n') });
			}
			if (strings.error.length > 0) {
				SimpleNotification.error({ text: strings.error.join('\n') });
			}
		}
		await Promise.all(promises);
		return report;
	};

	mangaDexFunction = (fct: 'unfollow' | 'status' | 'score'): string => {
		switch (fct) {
			case 'unfollow':
				return MangaDex.api('unfollow', this.title.key.id!);
			case 'status':
				return MangaDex.api('update', this.title.key.id!, this.mdState.status);
			case 'score':
				return MangaDex.api('rating', this.title.key.id!, Math.round(this.mdState.score! / 10));
		}
	};

	/**
	 * Sync MangaDex Status or Rating.
	 */
	syncMangaDex = async (fct: 'unfollow' | 'status' | 'score'): Promise<RequestResponse> => {
		const response = await Runtime.request({
			method: 'GET',
			url: this.mangaDexFunction(fct),
			credentials: 'include',
			headers: { 'X-Requested-With': 'XMLHttpRequest' },
		});
		if (this.overview?.syncedMangaDex) {
			this.overview?.syncedMangaDex(fct, this);
		}
		return response;
	};

	/**
	 * Save a copy of the current Title to be able to restore some of it's value if the *Cancel* button is clicked
	 * 	in the this.displayReportNotifications function.
	 */
	saveState = (): LocalTitle => {
		this.previousMdState = { status: this.mdState.status, score: this.mdState.score };
		return JSON.parse(JSON.stringify(this.title)); // Deep copy
	};

	/**
	 * Restore chapters, mdStatus, mdScore, lastChapter, lastRead,
	 * 	inList, status, progress, score, start, end from previousState.
	 */
	restoreState = (title: LocalTitle): void => {
		if (this.previousMdState) {
			this.mdState.status = this.previousMdState.status;
			this.mdState.score = this.previousMdState.score;
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
	};

	refreshService = async (key: ActivableKey): Promise<void> => {
		if (!this.title.services[key]) return;
		const res = await Services[key].get(this.title.services[key]!);
		this.services[key] = res;
		await this.syncLocal();
		await this.syncExternal(true);
	};

	serviceImport = async (key: ActivableKey): Promise<void> => {
		const service = this.services[key];
		if (!service || typeof service === 'number') return;
		service.import(this.title);
		this.overview?.syncingService(key);
		const res = await service.persist();
		if (res > RequestStatus.CREATED) {
			this.overview?.syncedService(key, res, this.title);
		} else this.overview?.syncedService(key, service, this.title);
	};

	reportNotificationRow = (key: ActivableKey | StaticKey.SyncDex, status: string) => {
		const name = key === StaticKey.SyncDex ? 'SyncDex' : Services[key].name;
		return `![${name}|${Runtime.icon(key)}] **${name}**>*>[${status}]<`;
	};

	/**
	 * Display result notification, one line per Service
	 * {Icon} Name [Created] / [Synced] / [Imported]
	 * Display another notification for errors, with the same template
	 * {Icon} Name [Not Logged In] / [Bad Request] / [Server Error]
	 */
	displayReportNotifications = (
		report: SyncReport,
		informations: ReportInformations,
		previousState: LocalTitle,
		onCancel?: () => void
	): void => {
		const updateRows: string[] = [];
		const errorRows: string[] = [];
		for (const key of Options.services) {
			if (report[key] === undefined) continue;
			if (report[key] === false) {
				if (informations.firstRequest) errorRows.push(this.reportNotificationRow(key, 'Logged Out'));
			} else if (this.title.services[key] === undefined) {
				if (informations.firstRequest) errorRows.push(this.reportNotificationRow(key, 'No ID'));
			} else if (report[key]! <= RequestStatus.DELETED) {
				updateRows.push(
					this.reportNotificationRow(
						key,
						report[key] === RequestStatus.CREATED
							? 'Created'
							: report[key] === RequestStatus.DELETED
							? 'Deleted'
							: 'Synced'
					)
				);
			} else {
				let error = '';
				switch (report[key]) {
					case RequestStatus.SERVER_ERROR:
						error = 'Server Error';
						break;
					case RequestStatus.BAD_REQUEST:
						error = 'Bad Request';
						break;
					case RequestStatus.MISSING_TOKEN:
						error = 'Logged Out';
						break;
					case RequestStatus.NOT_FOUND:
						error = 'Not Found';
						break;
					case RequestStatus.FAIL:
					default:
						error = 'Error';
				}
				errorRows.push(this.reportNotificationRow(key, error));
			}
		}
		// Display Notifications
		if (Options.notifications) {
			let ending = '';
			if (updateRows.length > 0) {
				ending = updateRows.join('\n');
			} else if (!informations.firstRequest || Options.services.length == 0 || informations.localUpdated) {
				ending = this.reportNotificationRow(StaticKey.SyncDex, 'Synced');
			}
			SimpleNotification.success({
				title: 'Progress Updated',
				image: MangaDex.thumbnail(this.title.key),
				text: `Chapter ${this.title.progress.chapter}\n${
					informations.created ? '**Start Date** set to Today !\n' : ''
				}${informations.completed ? '**End Date** set to Today !\n' : ''}${ending}`,
				buttons: [
					{
						type: 'warning',
						value: 'Cancel',
						onClick: async (notification) => {
							notification.closeAnimated();
							this.restoreState(previousState);
							await this.title.persist();
							this.overview?.syncedLocal(this.title);
							await this.syncExternal();
							if (onCancel) onCancel();
							SimpleNotification.success({
								title: 'Cancelled',
								image: MangaDex.thumbnail(this.title.key),
								text: `**${this.title.name}** update cancelled.\n${
									this.title.status == Status.NONE
										? 'Removed from list'
										: `[${StatusMap[this.title.status]}] Chapter ${this.title.progress.chapter}`
								}`,
							});
						},
					},
					{ type: 'message', value: 'Close', onClick: (notification) => notification.closeAnimated() },
				],
			});
		}
		if (Options.errorNotifications && errorRows.length > 0) {
			SimpleNotification.error(
				{
					title: 'Error',
					image: MangaDex.thumbnail(this.title.key),
					text: errorRows.join('\n'),
				},
				{ sticky: true }
			);
		}
	};
}

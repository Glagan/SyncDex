import {
	Title,
	ExternalTitleList,
	ActivableKey,
	ReverseActivableName,
	BaseTitle,
	ExternalTitle,
	ServiceKeyType,
	ReverseServiceName,
	ServiceKey,
	StaticKey,
} from '../Core/Title';
import { Options } from '../Core/Options';
import { GetService } from './Service';
import { Runtime } from '../Core/Runtime';
import { Overview } from './Overview';

export type SyncReport = {
	[key in ActivableKey]?: RequestStatus | false;
};

export class SyncModule {
	title: Title;
	overview: Overview;
	loadingServices: Promise<BaseTitle | RequestStatus>[] = [];
	services: { [key in ActivableKey]?: BaseTitle | RequestStatus } = {};

	constructor(title: Title, overview: Overview) {
		this.title = title;
		this.overview = overview;
		if (this.overview.bind) this.overview.bind(this);
	}

	/**
	 * Send initial Media requests concurrently for each services.
	 */
	initialize = (): void => {
		this.services = {}; // Reset services
		if (Options.services.length == 0) {
			this.overview.hasNoServices();
			return;
		}
		const activeServices = Object.keys(this.title.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		// Add Services ordered by Options.services to check Main Service first
		for (const key of Options.services) {
			const hasId = activeServices.indexOf(key) >= 0;
			this.overview.initializeService(key, hasId);
			if (hasId) {
				const initialRequest = GetService(ReverseActivableName[key]).get(this.title.services[key]!);
				this.loadingServices.push(initialRequest);
				initialRequest.then((res) => {
					this.overview.receivedInitialRequest(key, res, this);
					this.services[key] = res;
					return res;
				});
			}
		}
	};

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	syncLocal = async (): Promise<boolean> => {
		if (this.loadingServices.length > 0) {
			await Promise.all(this.loadingServices);
			this.loadingServices = [];
			// Find pepper
			for (const key in this.services) {
				const response = this.services[key as ActivableKey];
				if (response instanceof BaseTitle && response.max) {
					if (!this.title.max) {
						this.title.max = { chapter: undefined, volume: undefined };
					}
					if (
						!this.title.max.chapter ||
						(response.max.chapter && response.max.chapter < this.title.max.chapter)
					) {
						this.title.max.chapter = response.max.chapter;
					}
					if (
						!this.title.max.volume ||
						(response.max.volume && response.max.volume < this.title.max.volume)
					) {
						this.title.max.volume = response.max.volume;
					}
				}
			}
		}
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		this.overview.syncingLocal();
		let doSave = false;
		for (const key of [...Options.services].reverse()) {
			if (this.services[key] === undefined) continue;
			const response = this.services[key];
			if (response instanceof BaseTitle && response.loggedIn) {
				// Check if any of the ServiceTitle is more recent than the local Title
				if (response.inList && (this.title.inList || response.isMoreRecent(this.title))) {
					// If there is one, sync with it and save
					this.title.inList = false;
					this.title.merge(response);
					doSave = true;
				}
				// Finish retrieving the ID if required -- AnimePlanet has 2 fields
				if ((<typeof ExternalTitle>response.constructor).requireIdQuery) {
					(this.title.services[
						(<typeof ExternalTitle>response.constructor).serviceKey
					] as ServiceKeyType) = response.id;
					doSave = true;
				}
			}
		}
		if (doSave) await this.title.persist();
		this.overview.syncedLocal(this.title);
		return doSave;
	};

	syncExternal = async (checkAutoSyncOption: boolean = false): Promise<SyncReport> => {
		const promises: Promise<RequestStatus>[] = [];
		const report: SyncReport = {};
		for (const key of Options.services) {
			const service = this.services[key];
			if (service === undefined) continue;
			if (!(service instanceof BaseTitle)) {
				report[key] = service as RequestStatus;
				continue;
			}
			if (!service.loggedIn) {
				report[key] = false;
				continue;
			}
			service.isSynced(this.title);
			// If Auto Sync is on, import from now up to date Title and persist
			if ((!checkAutoSyncOption || Options.autoSync) && (!service.inList || !service.synced)) {
				service.import(this.title);
				this.overview.syncingService(key);
				const promise = service.persist();
				promises.push(promise);
				promise.then((res) => {
					if (res > RequestStatus.CREATED) {
						this.overview.syncedService(key, res, this.title);
					} else this.overview.syncedService(key, service, this.title);
					report[key] = res;
				});
				// Always update the overview to check against possible imported ServiceTitle
			} else this.overview.syncedService(key, service, this.title);
		}
		// Update MangaDex List Status and Score -- TODO: Check if logged in
		if (Options.updateMD) {
			const strings: { success: string[]; error: string[] } = { success: [], error: [] };
			if (this.title.mdStatus != this.title.status) {
				this.title.mdStatus = this.title.status;
				const response = await this.syncMangaDex(this.title.mdStatus == Status.NONE ? 'unfollow' : 'status');
				if (response.ok) {
					strings.success.push('**MangaDex Status** updated.');
					if (this.overview.syncedMangaDex) {
						this.overview.syncedMangaDex('status', this.title);
					}
				} else {
					strings.error.push(`Error while updating **MangaDex Status**.\ncode: ${response.code}`);
				}
			}
			if (this.title.score > 0 && Math.round(this.title.mdScore / 10) != Math.round(this.title.score / 10)) {
				// Convert 0-100 SyncDex Score to 0-10
				this.title.mdScore = this.title.score;
				const response = await this.syncMangaDex('score');
				if (response.ok) {
					strings.success.push('**MangaDex Score** updated.');
					if (this.overview.syncedMangaDex) {
						this.overview.syncedMangaDex('score', this.title);
					}
				} else {
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

	mangaDexFunctionValues = (fct: 'unfollow' | 'status' | 'score'): string => {
		const baseAPI = 'https://mangadex.org/ajax/actions.ajax.php';
		let action;
		let field;
		let value;
		switch (fct) {
			case 'unfollow':
				action = 'manga_unfollow';
				field = 'type';
				value = this.title.id;
				break;
			case 'status':
				action = 'manga_follow';
				field = 'type';
				value = this.title.mdStatus!;
				break;
			case 'score':
				action = 'manga_rating';
				field = 'rating';
				value = Math.round(this.title.mdScore! / 10);
				break;
		}
		return `${baseAPI}?function=${action}&id=${this.title.id}&${field}=${value}&_=${Date.now()}`;
	};

	/**
	 * Sync MangaDex Status or Rating.
	 */
	syncMangaDex = async (fct: 'unfollow' | 'status' | 'score'): Promise<RequestResponse> => {
		const response = await Runtime.request({
			method: 'GET',
			url: this.mangaDexFunctionValues(fct),
			credentials: 'include',
			headers: {
				'X-Requested-With': 'XMLHttpRequest',
			},
		});
		if (this.overview.syncedMangaDex) {
			this.overview.syncedMangaDex(fct, this.title);
		}
		return response;
	};

	reportNotificationRow = (key: ServiceKey, status: string) =>
		`![${ReverseServiceName[key]}|${Runtime.icon(key)}] **${ReverseServiceName[key]}**>*>[${status}]<`;

	/**
	 * Display result notification, one line per Service
	 * {Icon} Name [Created] / [Synced] / [Imported]
	 * Display another notification for errors, with the same template
	 * {Icon} Name [Not Logged In] / [Bad Request] / [Server Error]
	 */
	displayReportNotifications = (
		report: SyncReport,
		created: boolean,
		completed: boolean,
		firstRequest: boolean,
		localUpdated: boolean
	): void => {
		const updateRows: string[] = [];
		const errorRows: string[] = [];
		for (const key of Options.services) {
			if (report[key] === undefined) continue;
			if (report[key] === false) {
				if (firstRequest) errorRows.push(this.reportNotificationRow(key, 'Logged Out'));
			} else if (this.title.services[key] === undefined) {
				if (firstRequest) errorRows.push(this.reportNotificationRow(key, 'No ID'));
			} else if (report[key]! <= RequestStatus.CREATED) {
				updateRows.push(
					this.reportNotificationRow(key, report[key] === RequestStatus.CREATED ? 'Created' : 'Synced')
				);
			} else {
				errorRows.push(
					this.reportNotificationRow(
						key,
						report[key] === RequestStatus.SERVER_ERROR ? 'Server Error' : 'Bad Request'
					)
				);
			}
		}
		// Display Notifications
		if (Options.notifications) {
			if (updateRows.length > 0) {
				SimpleNotification.success({
					title: 'Progress Updated',
					image: `https://mangadex.org/images/manga/${this.title.id}.thumb.jpg`,
					text: `Chapter ${this.title.progress.chapter}\n${created ? '**Start Date** set to Today !\n' : ''}${
						completed ? '**End Date** set to Today !\n' : ''
					}${updateRows.join('\n')}`,
				});
			} else if (!firstRequest || Options.services.length == 0 || localUpdated) {
				SimpleNotification.success({
					title: 'Progress Updated',
					text: `Chapter ${this.title.progress.chapter}\n${created ? '**Start Date** set to Today !\n' : ''}${
						completed ? '**End Date** set to Today !\n' : ''
					}${this.reportNotificationRow(StaticKey.SyncDex, 'Synced')}`,
				});
			}
		}
		if (Options.errorNotifications && errorRows.length > 0) {
			SimpleNotification.error(
				{
					title: 'Error',
					image: `https://mangadex.org/images/manga/${this.title.id}.thumb.jpg`,
					text: errorRows.join('\n'),
				},
				{ sticky: true }
			);
		}
	};

	refreshService = async (key: ActivableKey): Promise<void> => {
		if (!this.title.services[key]) return;
		const res = await GetService(ReverseActivableName[key]).get(this.title.services[key]!);
		this.services[key] = res;
		await this.syncLocal();
		await this.syncExternal(true);
	};

	serviceImport = async (key: ActivableKey): Promise<void> => {
		const service = this.services[key];
		if (!service || typeof service === 'number') return;
		service.import(this.title);
		this.overview.syncingService(key);
		const res = await service.persist();
		if (res > RequestStatus.CREATED) {
			this.overview.syncedService(key, res, this.title);
		} else this.overview.syncedService(key, service, this.title);
	};
}

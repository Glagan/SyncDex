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
		await Promise.all(this.loadingServices);
		this.loadingServices = [];
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		this.overview.syncingLocal();
		let doSave = false;
		for (const key of Options.services.reverse()) {
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
				const res = await service.persist();
				if (res > RequestStatus.CREATED) {
					this.overview.syncedService(key, res, this.title);
				} else this.overview.syncedService(key, service, this.title);
				report[key] = res;
				// Always update the overview to check against possible imported ServiceTitle
			} else this.overview.syncedService(key, service, this.title);
		}
		return report;
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
				SimpleNotification.success(
					{
						title: 'Progress Updated',
						image: `https://mangadex.org/images/manga/${this.title.id}.thumb.jpg`,
						text: `Chapter ${this.title.progress.chapter}\n${
							created ? '**Start Date** set to Today !\n' : ''
						}${updateRows.join('\n')}`,
					},
					{ position: 'bottom-left', sticky: true }
				);
			} else if (!firstRequest || Options.services.length == 0 || localUpdated) {
				SimpleNotification.success(
					{
						title: 'Progress Updated',
						text: `Chapter ${this.title.progress.chapter}\n${
							created ? '**Start Date** set to Today !\n' : ''
						}${this.reportNotificationRow(StaticKey.SyncDex, 'Synced')}`,
					},
					{ position: 'bottom-left', sticky: true }
				);
			}
		}
		if (Options.errorNotifications && errorRows.length > 0) {
			SimpleNotification.error(
				{
					title: 'Error',
					image: `https://mangadex.org/images/manga/${this.title.id}.thumb.jpg`,
					text: errorRows.join('\n'),
				},
				{ position: 'bottom-left', sticky: true } // Keep sticky
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

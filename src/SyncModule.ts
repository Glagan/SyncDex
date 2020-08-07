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
} from './Title';
import { Options } from './Options';
import { GetService } from './Service';
import { Runtime } from './Runtime';

export interface SyncEvents {
	beforeRequest?: (key: ActivableKey) => void;
	beforePersist?: (key: ActivableKey) => void;
	afterPersist?: (key: ActivableKey, response: RequestStatus) => Promise<void>;
	alreadySynced?: (key: ActivableKey) => Promise<void>;
}

export type SyncReport = {
	[key in ActivableKey]?: RequestStatus | false;
};

export class SyncModule {
	title: Title;
	services: ExternalTitleList;
	events: SyncEvents;

	constructor(title: Title) {
		this.title = title;
		this.services = {};
		this.events = {};
	}

	setEvents = (events: SyncEvents): void => {
		this.events = events;
	};

	/**
	 * Send initial Media requests concurrently for each services.
	 */
	initialize = (): void => {
		const activeServices = Object.keys(this.title.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		// Add Services ordered by Options.services to check Main Service first
		for (const key of Options.services) {
			if (activeServices.indexOf(key) >= 0) {
				if (this.events.beforeRequest) this.events.beforeRequest(key);
				this.services[key] = GetService(ReverseActivableName[key]).get(this.title.services[key]!);
			}
		}
	};

	/**
	 * Check if any Service in services is available, in the list and more recent that the local Title.
	 * If an external Service is more recent, sync with it and sync all other Services with the then synced Title.
	 */
	syncLocalTitle = async (): Promise<boolean> => {
		// Sync Title with the most recent ServiceTitle ordered by User choice
		// Services are reversed to select the first choice last
		let doSave = false;
		await Promise.all(Object.values(this.services));
		for (const key of Options.services.reverse()) {
			if (this.services[key] === undefined) continue;
			const response = await this.services[key];
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
		return doSave;
	};

	syncServices = async (checkAutoSyncOption: boolean = false): Promise<SyncReport> => {
		const report: SyncReport = {};
		const responses: Promise<void>[] = [];
		for (const serviceKey of Options.services) {
			if (this.services[serviceKey] === undefined) continue;
			responses.push(
				this.services[serviceKey]!.then(async (response) => {
					if (response instanceof BaseTitle) {
						if (!response.loggedIn) {
							report[serviceKey] = false;
							return;
						}
						response.isSynced(this.title);
						// If Auto Sync is on, import from now up to date Title and persist
						if ((!checkAutoSyncOption || Options.autoSync) && (!response.inList || !response.synced)) {
							if (this.events.beforePersist) this.events.beforePersist(serviceKey);
							response.import(this.title);
							const res = await response.persist();
							if (this.events.afterPersist) await this.events.afterPersist(serviceKey, res);
							report[serviceKey] = res;
							// Always update the overview to check against possible imported ServiceTitle
						} else if (this.events.alreadySynced) await this.events.alreadySynced(serviceKey);
					} else report[serviceKey] = response;
				})
			);
		}
		await Promise.all(responses);
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
}

import { Services } from '../Service/Class/Map';
import { ActivableKey, StaticKey } from '../Service/Keys';
import { dispatch, listen } from './Event';
import { Extension } from './Extension';
import { MangaDex } from './MangaDex';
import { Options } from './Options';
import { SyncModule } from './SyncModule';
import { StatusMap } from './Title';

export class UpdateQueue {
	static notifications: SimpleNotification[] = [];

	static register() {
		listen('sync:start', (payload) => {
			const title = payload.title;
			SimpleNotification.info({
				image: MangaDex.thumbnail(title.key, 'thumb'),
				text: `Syncing **${title.name}** ...`,
			});
		});
		listen('sync:end', (payload) => {
			if (payload.type == 'progress') {
				const { syncModule, result, report, state } = payload;
				UpdateQueue.displayReportNotifications(syncModule, result, report, state);
			} else if (payload.type == 'cancel') {
				const { syncModule } = payload;
				SimpleNotification.success({
					title: 'Cancelled',
					image: MangaDex.thumbnail(syncModule.title.key, 'thumb'),
					text: `**${syncModule.title.name}** update cancelled.\n${
						syncModule.title.status == Status.NONE
							? 'Removed from list'
							: `[${StatusMap[syncModule.title.status]}] Chapter ${syncModule.title.chapter}`
					}`,
				});
			}
			// TODO: payload.type == 'delete'
			// TODO: payload.type == 'status'
			// TODO: payload.type == 'score'
			// TODO: payload.type == 'edit'
		});
	}

	static reportNotificationRow = (key: ActivableKey | StaticKey.SyncDex, status: string) => {
		const name = key === StaticKey.SyncDex ? 'SyncDex' : Services[key].name;
		return `![${name}|${Extension.icon(key)}] **${name}**>*>[${status}]<`;
	};

	/**
	 * Display result notification, one line per Service
	 * {Icon} Name [Created] / [Synced] / [Imported]
	 * Display another notification for errors, with the same template
	 * {Icon} Name [Not Logged In] / [Bad Request] / [Server Error]
	 */
	static displayReportNotifications = (
		syncModule: SyncModule,
		result: ProgressUpdate,
		report: SyncReport,
		state: LocalTitleState
	): void => {
		const title = syncModule.title;
		const updateRows: string[] = [];
		const errorRows: string[] = [];
		for (const key of Options.services) {
			if (report[key] === undefined) continue;
			if (report[key] === false) {
				// TODO: First Request ?? Search why
				// if (informations.firstRequest) errorRows.push(UpdateQueue.reportNotificationRow(key, 'Logged Out'));
			} else if (title.services[key] === undefined) {
				// if (informations.firstRequest) errorRows.push(UpdateQueue.reportNotificationRow(key, 'No ID'));
			} else if (report[key]! <= RequestStatus.DELETED) {
				updateRows.push(
					UpdateQueue.reportNotificationRow(
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
				errorRows.push(UpdateQueue.reportNotificationRow(key, error));
			}
		}
		// Display Notifications
		if (Options.notifications) {
			let ending = '';
			if (updateRows.length > 0) {
				ending = updateRows.join('\n');
			} else if (Options.services.length == 0) {
				ending = UpdateQueue.reportNotificationRow(StaticKey.SyncDex, 'Synced');
			}
			SimpleNotification.success(
				{
					title: 'Progress Updated',
					image: MangaDex.thumbnail(title.key, 'thumb'),
					text: `Chapter ${title.chapter}\n${result.started ? '**Start Date** set to Today !\n' : ''}${
						result.completed ? '**End Date** set to Today !\n' : ''
					}${ending}`,
					buttons: [
						{
							type: 'warning',
							value: 'Cancel',
							onClick: async (notification) => {
								notification.closeAnimated();
								await syncModule.cancel(state);
							},
						},
						{ type: 'message', value: 'Close', onClick: (notification) => notification.closeAnimated() },
					],
				},
				{ duration: Options.successDuration }
			);
		}
		if (Options.errorNotifications && errorRows.length > 0) {
			SimpleNotification.error(
				{
					title: 'Error',
					image: MangaDex.thumbnail(title.key, 'thumb'),
					text: errorRows.join('\n'),
				},
				{ sticky: true }
			);
		}
	};

	static async confirm(syncModule: SyncModule, progress: Progress, reasons: string[]): Promise<void> {
		const title = syncModule.title;
		SimpleNotification.info(
			{
				title: 'Not Updated',
				image: MangaDex.thumbnail(title.key, 'thumb'),
				text: reasons.join(`\n`),
				buttons: [
					{
						type: 'success',
						value: 'Update',
						onClick: async (n) => {
							n.closeAnimated();
							syncModule.syncProgress(progress);
						},
					},
					{
						type: 'message',
						value: 'Close',
						onClick: (n) => n.closeAnimated(),
					},
				],
			},
			{ duration: Options.infoDuration }
		);
	}

	static noServices() {
		SimpleNotification.error(
			{
				title: 'No active Services',
				text: `You have no **active Services** !\nEnable one in the **Options** and refresh this page.\nAll Progress is still saved locally.`,
				buttons: [
					{
						type: 'info',
						value: 'Options',
						onClick: (notification) => {
							Extension.openOptions();
							notification.closeAnimated();
						},
					},
					{
						type: 'message',
						value: 'Close',
						onClick: (notification) => notification.closeAnimated(),
					},
				],
			},
			{ duration: Options.errorDuration }
		);
	}
}

import { Button } from 'SimpleNotification';
import { Services } from '../Service/Class/Map';
import { ActivableKey, ServiceKey, StaticKey } from '../Service/Keys';
import { listen } from './Event';
import { Extension } from './Extension';
import { MangaDex } from './MangaDex';
import { Options } from './Options';
import { SyncModule } from './SyncModule';
import { LocalTitle, StatusMap } from './Title';
import { Request } from '../Core/Request';
import { progressToString } from './Utility';

export class UpdateQueue {
	static notifications: { [key: number]: SimpleNotification } = {};

	static deleteNotification(id: number) {
		if (UpdateQueue.notifications[id]) {
			UpdateQueue.notifications[id].close();
		}
	}

	static deleteEvents(id: number) {
		return {
			onClose() {
				delete UpdateQueue.notifications[id];
			},
			onDeath() {
				delete UpdateQueue.notifications[id];
			},
		};
	}

	static register() {
		listen('sync:start', (payload) => {
			const title = payload.title;
			this.deleteNotification(title.key.id!);

			UpdateQueue.notifications[title.key.id!] = SimpleNotification.info(
				{
					image: MangaDex.thumbnail(title.key, 'thumb'),
					text: `Syncing **${title.name}** ...`,
				},
				{ sticky: true, events: this.deleteEvents(title.key.id!) }
			);
		});
		listen('sync:end', (payload) => {
			const title = payload.syncModule.title;
			this.deleteNotification(title.key.id!);

			if (payload.type == 'status') {
				this.notification('Status Updated', `Status updated to **${StatusMap[title.status]}**.`, payload);
			} else if (payload.type == 'progress') {
				this.notification(
					'Progress Updated',
					`Progress updated to **${progressToString(title.progress)}**\n${
						payload.result.started ? '**Start Date** set to Today !\n' : ''
					}${payload.result.completed ? '**End Date** set to Today !\n' : ''}`,
					payload
				);
			} else if (payload.type == 'score') {
				this.notification(
					'Score Updated',
					`Score updated to **${title.score}** (${Math.floor(title.score / 10)}/10).`,
					payload
				);
			} else if (payload.type == 'delete') {
				this.notification('Title Deleted', `Title deleted: TODO: Report on each services`, payload);
			} else if (payload.type == 'edit') {
				this.miniOverview('Updated', `**${payload.syncModule.title.name}** Updated.`, payload);
			} else if (payload.type == 'cancel') {
				this.miniOverview('Cancelled', `**${payload.syncModule.title.name}** Update cancelled.`, payload);
			}
		});
	}

	static reportNotificationRow(key: ActivableKey | StaticKey.SyncDex, status: string): string {
		const name = key === StaticKey.SyncDex ? 'SyncDex' : Services[key].name;
		return `![${name}|${Extension.icon(key)}] **${name}**>*>[${status}]<`;
	}

	/**
	 * Display result notification, one line per Service
	 * {Icon} Name [Status]
	 */
	static report(title: LocalTitle, report: SyncReport): string {
		const rows: string[] = [];
		for (const key of Options.services) {
			if (report[key] === undefined) continue;
			if (report[key] === false) {
				rows.push(this.reportNotificationRow(key, 'Logged out'));
			} else if (title.services[key] === undefined) {
				rows.push(this.reportNotificationRow(key, 'No ID'));
			} else if (report[key]! <= RequestStatus.DELETED) {
				rows.push(
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
				const error = Request.statusToString(report[key] as RequestStatus);
				rows.push(this.reportNotificationRow(key, error));
			}
		}
		return rows.join(`\n`);
	}

	static mdReport(report: MDListReport): string {
		const updated: string[] = [];
		if (report.status !== undefined) updated.push('Status');
		if (report.progress !== undefined) updated.push('Progress');
		if (report.rating !== undefined) updated.push('Rating');
		if (updated.length > 0) {
			return `![MangaDex|${Extension.icon(ServiceKey.MangaDex)}] Updated ${updated.join(', ')}.`;
		}
		return '';
	}

	static notification(
		title: string,
		message: string,
		payload: { syncModule: SyncModule; report: SyncReport; mdReport: MDListReport; state: LocalTitleState }
	) {
		const mdReport = this.mdReport(payload.mdReport);
		SimpleNotification.success(
			{
				title,
				image: MangaDex.thumbnail(payload.syncModule.title.key, 'thumb'),
				text: `${message}\n${this.report(payload.syncModule.title, payload.report)}${
					mdReport ? `\n${mdReport}` : ''
				}`,
				buttons: [this.cancelButton(payload), this.closeButton()],
			},
			{ duration: Options.successDuration, events: this.deleteEvents(payload.syncModule.title.key.id!) }
		);
	}

	static miniOverview(name: string, message: string, payload: { syncModule: SyncModule; state?: LocalTitleState }) {
		const title = payload.syncModule.title;
		// Add a "Cancel" button if payload.state exists
		// 	If state exists the notification is a "edit" type and cancellable
		const buttons: Button[] = [this.closeButton()];
		if (payload.state !== undefined) {
			buttons.unshift(this.cancelButton(payload as { syncModule: SyncModule; state: LocalTitleState }));
		}
		// Done
		SimpleNotification.success(
			{
				title: name,
				image: MangaDex.thumbnail(title.key, 'thumb'),
				text: `${message}\nStatus: **${StatusMap[title.status]}**\nProgress: **${progressToString(
					title.progress
				)}**\nScore: **${title.score}** (${Math.floor(title.score / 10)}/10)`,
				buttons,
			},
			{ duration: Options.successDuration, events: this.deleteEvents(payload.syncModule.title.key.id!) }
		);
		/*syncModule.title.status == Status.NONE
			? 'Removed from list'
			: `[${StatusMap[syncModule.title.status]}] Chapter ${syncModule.title.chapter}`*/
	}

	static cancelButton(payload: { syncModule: SyncModule; state: LocalTitleState }): Button {
		return {
			type: 'warning',
			value: 'Cancel',
			onClick: async (notification) => {
				notification.closeAnimated();
				await payload.syncModule.cancel(payload.state);
			},
		};
	}

	static closeButton(): Button {
		return {
			type: 'message',
			value: 'Close',
			onClick: (notification) => notification.closeAnimated(),
		};
	}

	static confirm(syncModule: SyncModule, progress: Progress, reasons: string[]) {
		const title = syncModule.title;
		this.deleteNotification(title.key.id!);

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
			{ duration: Options.infoDuration, events: this.deleteEvents(syncModule.title.key.id!) }
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

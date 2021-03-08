import { Button, Events } from 'SimpleNotification';
import { Services } from '../Service/Class/Map';
import { ActivableKey, ServiceKey, StaticKey } from '../Service/Keys';
import { listen } from './Event';
import { Extension } from './Extension';
import { MangaDex } from './MangaDex';
import { Options } from './Options';
import { SyncModule } from './SyncModule';
import { LocalTitle, StatusMap } from './Title';
import { Http } from './Http';
import { progressToString } from './Utility';

export class UpdateQueue {
	static notifications: { [key: number]: SimpleNotification } = {};
	static mdNotifications: { [key: number]: SimpleNotification } = {};

	static deleteNotification(namespace: 'sync' | 'mangadex', id: number) {
		if (namespace == 'sync' && this.notifications[id]) {
			this.notifications[id].close();
		} else if (namespace == 'mangadex' && this.mdNotifications[id]) {
			this.mdNotifications[id].close();
		}
	}

	static deleteEvents(namespace: 'sync' | 'mangadex', id: number): Partial<Events> {
		return {
			onClose: () => {
				if (namespace == 'sync') {
					delete this.notifications[id];
				} else {
					delete this.mdNotifications[id];
				}
			},
			onDeath: (n) => {
				n.disableButtons();
				n.closeAnimated();
				if (namespace == 'sync') {
					delete this.notifications[id];
				} else {
					delete this.mdNotifications[id];
				}
			},
		};
	}

	static register() {
		listen('sync:start', (payload) => {
			const title = payload.title;
			this.deleteNotification('sync', title.key.id!);

			this.notifications[title.key.id!] = SimpleNotification.info(
				{
					image: MangaDex.thumbnail(title.key, 'thumb'),
					text: `Syncing **${title.name}** ...`,
					buttons: [this.closeButton()],
				},
				{ sticky: true, events: this.deleteEvents('sync', title.key.id!) }
			);
		});
		listen('sync:end', (payload) => {
			const title = payload.syncModule.title;
			this.deleteNotification('sync', title.key.id!);
			if ((payload as any).mdReport !== undefined) {
				this.deleteNotification('mangadex', title.key.id!);
			}

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
				this.notification('Title Deleted', `**${payload.syncModule.title.name}** Deleted.`, payload);
			} else if (payload.type == 'edit') {
				this.miniOverview('Updated', `**${payload.syncModule.title.name}** Updated.`, payload);
			} else if (payload.type == 'cancel') {
				this.miniOverview('Cancelled', `**${payload.syncModule.title.name}** Update cancelled.`, payload);
			}
		});
		listen('mangadex:syncing', (payload) => {
			const title = payload.title;
			if (this.notifications[title.key.id!]) return;
			this.deleteNotification('mangadex', title.key.id!);

			this.mdNotifications[title.key.id!] = SimpleNotification.info(
				{
					image: MangaDex.thumbnail(title.key, 'thumb'),
					text: `Syncing **${title.name}** ...`,
					buttons: [this.closeButton()],
				},
				{ sticky: true, events: this.deleteEvents('mangadex', title.key.id!) }
			);
		});
		listen('mangadex:synced', (payload) => {
			const title = payload.title;
			this.deleteNotification('mangadex', title.key.id!);

			// Add to report
			if (payload.field == 'unfollow') {
				this.mdNotifications[title.key.id!] = SimpleNotification.success(
					{
						image: MangaDex.thumbnail(title.key, 'thumb'),
						text: `![MangaDex|${Extension.icon(ServiceKey.MangaDex)}] Unfollowed.`,
						buttons: [this.closeButton()],
					},
					{ duration: Options.successDuration, events: this.deleteEvents('mangadex', title.key.id!) }
				);
			} else {
				this.mdNotifications[title.key.id!] = SimpleNotification.success(
					{
						image: MangaDex.thumbnail(title.key, 'thumb'),
						text: this.mdReport({ [payload.field]: payload.status }),
						buttons: [this.closeButton()],
					},
					{ duration: Options.successDuration, events: this.deleteEvents('mangadex', title.key.id!) }
				);
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
			} else if (report[key]! <= ResponseStatus.DELETED) {
				rows.push(
					this.reportNotificationRow(
						key,
						report[key] === ResponseStatus.CREATED
							? 'Created'
							: report[key] === ResponseStatus.DELETED
							? 'Deleted'
							: 'Synced'
					)
				);
			} else {
				const error = Http.statusToString(report[key] as ResponseStatus);
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
			return `![MangaDex|${Extension.icon(ServiceKey.MangaDex)}] Synced ${updated.join(', ')}.`;
		}
		return '';
	}

	static notification(
		title: string,
		message: string,
		payload: { syncModule: SyncModule; report: SyncReport; mdReport: MDListReport; state: LocalTitleState }
	) {
		const mdReport = this.mdReport(payload.mdReport);
		this.notifications[payload.syncModule.title.key.id!] = SimpleNotification.success(
			{
				title,
				image: MangaDex.thumbnail(payload.syncModule.title.key, 'thumb'),
				text: `${message}\n${this.report(payload.syncModule.title, payload.report)}${
					mdReport ? `\n${mdReport}` : ''
				}`,
				buttons: [this.cancelButton(payload), this.closeButton()],
			},
			{ duration: Options.successDuration, events: this.deleteEvents('sync', payload.syncModule.title.key.id!) }
		);
	}

	static miniOverview(
		name: string,
		message: string,
		payload: { syncModule: SyncModule; report?: SyncReport; state?: LocalTitleState }
	) {
		const title = payload.syncModule.title;
		// Add a "Cancel" button if payload.state exists
		// 	If state exists the notification is a "edit" type and cancellable
		const buttons: Button[] = [this.closeButton()];
		if (payload.state !== undefined) {
			buttons.unshift(this.cancelButton(payload as { syncModule: SyncModule; state: LocalTitleState }));
		}
		// Done
		const report = payload.report ? `\n${this.report(payload.syncModule.title, payload.report)}` : '';
		this.notifications[payload.syncModule.title.key.id!] = SimpleNotification.success(
			{
				title: name,
				image: MangaDex.thumbnail(title.key, 'thumb'),
				text: `${message}\nStatus: **${StatusMap[title.status]}**\nProgress: **${progressToString(
					title.progress
				)}**\nScore: **${title.score}** (${Math.floor(title.score / 10)}/10)${report}`,
				buttons,
			},
			{ duration: Options.successDuration, events: this.deleteEvents('sync', payload.syncModule.title.key.id!) }
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
		this.deleteNotification('sync', title.key.id!);

		this.notifications[syncModule.title.key.id!] = SimpleNotification.info(
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
					this.closeButton(),
				],
			},
			{ duration: Options.infoDuration, events: this.deleteEvents('sync', syncModule.title.key.id!) }
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
					this.closeButton(),
				],
			},
			{ duration: Options.errorDuration }
		);
	}
}

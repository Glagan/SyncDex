import { Alarms, browser } from 'webextension-polyfill-ts';
import { loadLogs, log } from '../Core/Log';
import { Message } from '../Core/Message';
import { SaveSync } from '../Core/SaveSync';
import { Storage } from '../Core/Storage';
import { SaveSyncServices } from '../SaveSync/Map';
import { setIcon } from './Utility';

export namespace ManageSaveSync {
	export const AlarmName = 'saveSyncBackup';

	export async function listener(alarm: Alarms.Alarm) {
		if (alarm.name == ManageSaveSync.AlarmName) {
			await ManageSaveSync.sync(true);
		}
	}

	export async function sync(force: boolean = false) {
		await loadLogs(true);

		setIcon('Save Sync in progress', '#45A1FF', '...');
		const state = await Storage.get('saveSync');
		if (state !== undefined) {
			if (!(await Storage.get(StorageUniqueKey.SaveSyncInProgress, false))) {
				const saveSyncServiceClass = SaveSyncServices[state.service];
				if (saveSyncServiceClass !== undefined) {
					await loadLogs(true);
					await Storage.set(StorageUniqueKey.SaveSyncInProgress, true);
					let status = SaveSyncResult.ERROR;
					try {
						await Message.send('saveSync:event:start');
						// await browser.runtime.sendMessage({ action: MessageAction.saveSyncStart }).catch((_e) => _e);
						/// @ts-ignore saveSyncServiceClass is *NOT* abstract
						const saveSyncService: SaveSync = new saveSyncServiceClass();
						SaveSync.state = state;
						status = await saveSyncService.sync(force);
						if (status == SaveSyncResult.NOTHING) {
							await log(`Save already synced with ${state.service}`);
						} else if (status == SaveSyncResult.ERROR) {
							await log(`Couldn't sync your local save with ${state.service}`);
						} else if (status != SaveSyncResult.SYNCED) {
							await log(`Synced your save with ${state.service}`);
						}
					} catch (error) {
						log(error);
					}
					await Storage.remove(StorageUniqueKey.SaveSyncInProgress);
					await Message.send('saveSync:event:finish', { status });
					/*await browser.runtime
					.sendMessage({ action: MessageAction.saveSyncComplete, status: result })
					.catch((_e) => _e);*/
					setIcon('SyncDex', '#058b00', '\u2713');
				} else {
					delete SaveSync.state;
					delete (state as any).token;
					delete (state as any).refresh;
					await log(`Invalid Save Sync Service [${state}]`);
					await Storage.remove('saveSync');
					setIcon();
				}
			} else setIcon();
		} else setIcon();
	}

	/**
	 * Schedule an alarm that will trigger in "delay" minutes to start a Save Sync.
	 * @param delay The delay before saving (minutes)
	 */
	export async function start(delay?: number) {
		const alarm = await browser.alarms.get(AlarmName);
		delay = delay !== undefined ? delay : 1;
		if (delay === 0) {
			if (alarm) {
				browser.alarms.clear(AlarmName);
				setIcon();
			}
			await sync();
		} else if (!alarm) {
			const scheduled = new Date(Date.now() + delay * 60 * 1000);
			setIcon(
				`Save will Sync in less than ${delay}minute${delay > 1 ? 's' : ''} (${scheduled.toLocaleString()})`,
				'#45A1FF',
				`${delay}m`
			);
			browser.alarms.create(AlarmName, { delayInMinutes: delay });
		}
		return true;
	}

	export async function logout() {
		setIcon();
		browser.alarms.get(AlarmName).then((alarm) => {
			if (alarm) browser.alarms.clear(AlarmName);
		});
		delete SaveSync.state;
		await Storage.remove([
			StorageUniqueKey.SaveSync,
			StorageUniqueKey.SaveSyncInProgress,
			StorageUniqueKey.LastSync,
		]);
	}
}

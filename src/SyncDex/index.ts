import { SyncDex } from './SyncDex';
import { Options } from '../Core/Options';
import { SaveSync } from '../Core/SaveSync';
import { LocalStorage } from '../Core/Storage';

console.log('SyncDex :: Index');

(async () => {
	SimpleNotification._options.position = 'bottom-left';
	if (document.body.classList.contains('sc-loaded')) {
		SimpleNotification.info(
			{
				text: 'SyncDex reloaded',
				buttons: [
					{ value: 'Reload', type: 'success', onClick: () => window.location.reload() },
					{ value: 'Close', type: 'message', onClick: (n) => n.closeAnimated() },
				],
			},
			{ sticky: true }
		);
		return;
	}
	document.body.classList.add('sc-loaded');
	await Options.load();
	SaveSync.state = await LocalStorage.get('saveSync');
	const sync = new SyncDex();
	sync.execute(`${window.location.pathname}${window.location.search}`);
})();

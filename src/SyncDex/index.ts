import { SyncDex } from './SyncDex';
import { Options } from '../Core/Options';
import { SaveSync } from '../Core/SaveSync';
import { LocalStorage } from '../Core/Storage';

console.log('SyncDex :: Index');

(async () => {
	SimpleNotification._options.position = 'bottom-left';
	await Options.load();
	SaveSync.state = await LocalStorage.get('saveSync');
	const sync = new SyncDex();
	sync.execute(`${window.location.pathname}${window.location.search}`);
})();

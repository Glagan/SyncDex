import { SyncDex } from './SyncDex';
import { Options } from '../Core/Options';

console.log('SyncDex :: Index');

(async () => {
	SimpleNotification._options.position = 'bottom-left';
	const sync = new SyncDex();
	await Options.load();
	sync.execute(`${window.location.pathname}${window.location.search}`);
})();

import { setBrowser } from '../Core/Browser';
import { SyncDex } from './SyncDex';
import { Options } from '../Core/Options';

console.log('SyncDex :: Index');

(async () => {
	setBrowser();
	const sync = new SyncDex();
	await Options.load();
	sync.execute(`${window.location.pathname}${window.location.search}`);
})();

import { setBrowser } from './Browser';
import { SyncDex } from './SyncDex';
import { Options } from './Options';

console.log('SyncDex :: Index');

(async () => {
	setBrowser();
	const sync = new SyncDex();
	await Options.load();
	sync.execute(window.location.pathname);
})();

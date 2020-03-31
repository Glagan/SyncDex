import { setBrowser } from './Browser';
import { SyncDex } from './SyncDex';

console.log('SyncDex :: Index');

setBrowser();
const sync = new SyncDex();
sync.execute(window.location.pathname);

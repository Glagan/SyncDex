import { SyncDex } from './SyncDex';

console.log('SyncDex :: Index');

const sync = new SyncDex();
sync.execute(window.location.pathname);

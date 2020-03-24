import { SyncDex } from './SyncDex';

const sync = new SyncDex();
sync.execute(window.location.pathname);

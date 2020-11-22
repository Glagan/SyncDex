import { SaveSync } from './SaveSync';
import { Dropbox } from '../SaveSync/Dropbox';

export const SaveSyncServices: { [key: string]: typeof SaveSync } = {
	Dropbox: Dropbox,
};

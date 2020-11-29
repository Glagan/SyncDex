import { SaveSync } from './SaveSync';
import { Dropbox } from '../SaveSync/Dropbox';
import { GoogleDrive } from '../SaveSync/GoogleDrive';

export const SaveSyncServices: { [key: string]: typeof SaveSync } = {
	Dropbox: Dropbox,
	GoogleDrive: GoogleDrive,
};

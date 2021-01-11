import { SaveSync } from '../Core/SaveSync';
import { Dropbox } from './Dropbox';
import { GoogleDrive } from './GoogleDrive';

export const SaveSyncServices: { [key: string]: typeof SaveSync } = {
	Dropbox: Dropbox,
	GoogleDrive: GoogleDrive,
};

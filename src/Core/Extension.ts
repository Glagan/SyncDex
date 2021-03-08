import { browser } from 'webextension-polyfill-ts';
import { log } from './Log';
import { Message } from './Message';

export class Extension {
	/**
	 * Open a new tab of the Options page.
	 */
	static async openOptions(): Promise<void> {
		try {
			// TODO: Handle background message sender ?
			return Message.send('openOptions');
		} catch (error) {
			await log(`Could not open Options with Runtime.openOptions: ${error}`);
		}
	}

	/**
	 * Returns the full URL of file from the extension.
	 * @param file Absolute path to the file
	 */
	static file(file: string): string {
		return browser.runtime.getURL(file);
	}

	static icon(icon: string): string {
		return Extension.file(`/icons/${icon}.png`);
	}
}

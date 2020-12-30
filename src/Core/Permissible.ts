import { browser } from 'webextension-polyfill-ts';
import { Runtime } from './Runtime';

export abstract class Permissible {
	static readonly optionalPermissions: string[] = [];

	get permissions(): string[] {
		return (<typeof Permissible>this.constructor).optionalPermissions;
	}

	hasPermissions(): Promise<boolean> {
		if (this.permissions.length > 0) {
			return browser.permissions.contains({ origins: this.permissions });
		}
		return new Promise((resolve) => resolve(true));
	}

	/*async requestPermissions(): Promise<boolean> {
		const hasPermissions = await this.hasPermissions();
		if (!hasPermissions) {
			return browser.permissions.request({ origins: this.permissions });
		}
		return hasPermissions;
	}*/
}

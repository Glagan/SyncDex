import { browser } from 'webextension-polyfill-ts';

export abstract class Permissible {
	static readonly optionalPermissions: string[] = [];
	static _permissions?: boolean;

	get permissions(): string[] {
		return (<typeof Permissible>this.constructor).optionalPermissions;
	}

	async hasPermissions(): Promise<boolean> {
		const that = <typeof Permissible>this.constructor;
		if (that._permissions === undefined) {
			if (this.permissions.length > 0) {
				that._permissions = await browser.permissions.contains({ origins: this.permissions });
			} else {
				that._permissions = true;
			}
		}
		return new Promise((resolve) => resolve(that._permissions!));
	}

	/*async requestPermissions(): Promise<boolean> {
		const hasPermissions = await this.hasPermissions();
		if (!hasPermissions) {
			return browser.permissions.request({ origins: this.permissions });
		}
		return hasPermissions;
	}*/

	async removePermissions(): Promise<void> {
		const hasPermissions = await this.hasPermissions();
		if (hasPermissions) return browser.permissions.remove({ origins: this.permissions });
	}
}

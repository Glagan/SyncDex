import { browser } from 'webextension-polyfill-ts';

export abstract class Permissible {
	static readonly optionalPermissions: string[] = [];
	_permissions?: boolean;

	get permissions(): string[] {
		return (<typeof Permissible>this.constructor).optionalPermissions;
	}

	async hasPermissions(): Promise<boolean> {
		if (this._permissions === undefined) {
			if (this.permissions.length > 0) {
				this._permissions = await browser.permissions.contains({ origins: this.permissions });
			} else {
				this._permissions = true;
			}
		}
		return new Promise((resolve) => resolve(this._permissions!));
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

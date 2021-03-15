import { log } from './Log';
import { DefaultOptions, LogLevel, Options } from './Options';

/**
 * Update for a version.subVersion.
 * Applied when the Update version match the current version.
 */
interface Update {
	version: number;
	subVersion: number;
	fnct: () => void;
}

export class Updates {
	static list: Update[] = [
		{
			version: 0.2,
			subVersion: 1,
			fnct: () => (Options.logLevel = LogLevel.Default),
		},
		{
			version: 0.2,
			subVersion: 12,
			fnct: () => {
				Options.errorDuration = 4000;
				Options.infoDuration = 4000;
				Options.successDuration = 4000;
			},
		},
		{
			version: 0.3,
			subVersion: 1,
			fnct: () => (Options.displaySyncStart = false),
		},
		{
			version: 0.3,
			subVersion: 4,
			fnct: () => (Options.displayProgressUpdated = true),
		},
	];

	static async apply(): Promise<boolean> {
		let updated = false;
		const version = `${DefaultOptions.version}.${DefaultOptions.subVersion}`;
		const currentVersion = `${Options.version}.${Options.subVersion}`;

		if (version != currentVersion) {
			for (const update of this.list) {
				if (
					update.version > Options.version ||
					(update.version == Options.version && update.subVersion > Options.subVersion)
				) {
					update.fnct();
					Options.version = update.version;
					Options.subVersion = update.subVersion;
					await log(`Applied patch version ${update.version}.${update.subVersion}`);
				}
			}
			Options.version = DefaultOptions.version;
			Options.subVersion = DefaultOptions.subVersion;
			await log(`Updated from version ${currentVersion} to ${version}`);
			await Options.save();
			updated = true;
		}

		return updated;
	}
}

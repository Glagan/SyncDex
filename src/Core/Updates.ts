import { log } from './Log';
import { DefaultOptions, LogLevel, Options } from './Options';

interface Update {
	version: number;
	subVersion: number;
	fnct: () => void;
}

export class Updates {
	static list: Update[] = [
		{
			version: 0.2,
			subVersion: 0.1,
			fnct: () => (Options.logLevel = LogLevel.Default),
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

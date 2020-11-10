import { DOM } from '../Core/DOM';
import { Mochi, MochiExtra } from '../Core/Mochi';
import { ModuleOptions } from '../Core/Module';
import { ModuleInterface } from '../Core/ModuleInterface';
import { AvailableOptions, Options } from '../Core/Options';
import { StaticName } from '../Core/Service';
import { TitleCollection } from '../Core/Title';

export abstract class SpecialService {
	options: ModuleOptions = {
		merge: {
			description: 'Merge with current local save',
			display: true,
			default: true,
		},
		mochi: {
			description: 'Check Services ID with Mochi after Importing',
			display: true,
			default: true,
		},
	};
	perConvert: number = 250;

	optionExists = (key: string): key is keyof AvailableOptions => {
		return Options[key as keyof AvailableOptions] !== undefined;
	};

	assignValidOption = <K extends keyof AvailableOptions>(key: K, value: AvailableOptions[K]): boolean => {
		// Check if the value is the same type as the value in the Options
		if (typeof value === typeof Options[key]) {
			// Check if the key actually exist
			if ((Options as AvailableOptions)[key] !== undefined || key === 'mainService') {
				(Options as AvailableOptions)[key] = value;
				return true;
			}
		}
		return false;
	};

	mochi = async (titles: TitleCollection, moduleInterface?: ModuleInterface, extras?: MochiExtra): Promise<void> => {
		let current = 0;
		const progress = DOM.create('p');
		const notification = moduleInterface?.message('loading', [progress]);
		const length = titles.length;
		const max = Math.ceil(length / this.perConvert);
		for (let i = 0; !moduleInterface?.doStop && i < max; i++) {
			const titleList = titles.slice(current, current + this.perConvert);
			current += this.perConvert;
			progress.textContent = `Finding Services with Mochi for title ${Math.min(
				length,
				current + this.perConvert
			)} out of ${length}.`;
			const allConnections = await Mochi.findMany(
				titleList.map((t) => t.key.id!),
				StaticName.MangaDex,
				extras
			);
			if (allConnections !== undefined) {
				for (const key in allConnections) {
					const title = titleList.find((t) => t.key.id == parseInt(key));
					if (title) Mochi.assign(title, allConnections[key]);
				}
			}
		}
		notification?.classList.remove('loading');
	};

	abstract async start(): Promise<void>;
}

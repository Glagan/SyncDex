import { ModuleOptions } from '../Core/Module';

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

	abstract async start(): Promise<void>;
}

import { ServiceKey } from './Service';
import { AvailableOptions } from './Options';

interface Progress {
	chapter: number;
	volume?: number;
}

type ExportOptions = {
	options?: AvailableOptions;
};

type ExportHistory = {
	history?: number[];
};

type ExportedTitles = {
	[key: string]: Title;
};

type ExportedSave = ExportOptions & ExportHistory & ExportedTitles;

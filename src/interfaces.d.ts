import { ServiceKey } from './Service/Service';
import { AvailableOptions } from './Options';

interface Progress {
	chapter: number;
	volume?: number;
}

interface HistoryList {
	[key: number]: number;
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

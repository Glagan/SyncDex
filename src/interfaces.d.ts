import { ServiceKey } from './Service/Service';
import { AvailableOptions } from './Options';

interface Progress {
	chapter: number;
	volume?: number;
}

interface Title {
	services: { [key in ServiceKey]?: number | string };
	progress: Progress;
	chapters: number[];
	initial?: {
		start: number;
		end: number;
		status: Status;
	};
	lastTitle?: number;
	lastCheck?: number;
	// History
	chapterId?: number;
	name?: string;
	lastRead?: number;
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

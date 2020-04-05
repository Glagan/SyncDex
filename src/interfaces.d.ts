interface Progress {
	chapter: number;
	volume?: number;
}

interface Title {
	services: {
		md: number;
		mal?: number;
		al?: number;
		ku?: number;
		mu?: number;
		ap?: string;
	};
	progress: Progress;
	lastCheck: number;
	chapters: number[];
	initial: {
		start: number;
		end: number;
		status: Status;
	};
}

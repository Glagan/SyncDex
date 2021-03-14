export function zeroPad(n: number): string {
	return ('00' + n).slice(-2);
}

export function isDate(date?: any): date is Date {
	return date instanceof Date;
}

export function dateFormatInput(timestamp: number | Date): string {
	let d = typeof timestamp === 'object' ? timestamp : new Date(timestamp);
	return `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-${zeroPad(d.getDate())}`;
}

export function dateFormat(timestamp: number | Date, full: boolean = false): string {
	let d = typeof timestamp === 'object' ? timestamp : new Date(timestamp);
	return `${d.getDate()} ${d.toDateString().split(' ')[1]} ${d.getFullYear()}${
		full ? ` ${d.toTimeString().split(' ')[0]}` : ''
	}`;
}

/**
 * Return true if both Dates Year, Month and Date are equal
 */
export function dateCompare(d1: Date, d2: Date): boolean {
	return d1.getFullYear() == d2.getFullYear() && d1.getMonth() == d2.getMonth() && d1.getDate() == d2.getDate();
}

/**
 * source: https://stackoverflow.com/a/9517879
 * Inject a page script
 * Content scripts don't have access to variables, this does
 * Communicate using events: https://stackoverflow.com/a/19312198
 * @param {function} func The function to be injected and executed
 */
export function injectScript(func: Function) {
	const script = document.createElement('script');
	script.textContent = `(${func})();`;
	(document.head || document.documentElement).appendChild(script);
	script.remove();
}

export function progressToString(progress: Progress): string {
	const volume = progress.volume && progress.volume > 0 ? `Vol. ${progress.volume}` : '';
	const chapter = progress.chapter >= 0 ? (volume ? ` Ch. ${progress.chapter}` : `Chapter ${progress.chapter}`) : '';
	return progress.oneshot ? 'Oneshot' : `${volume}${chapter}`;
}

/**
 * Convert a chapter name with a chapter progress inside.
 * Found formats:
 * 	 	(Volume X) Chapter Y(.Z)
 * 		(Vol. X) Ch. Y(.Z)
 * Progress.chapter is kept as NaN on error
 * @param chapter Chapter name
 * @see https://regexr.com/5oheg
 */
export function progressFromString(chapter: string): Progress {
	// Oneshot
	if (chapter.toLocaleLowerCase() == 'oneshot') {
		return { chapter: 1, oneshot: true };
	}

	// (Volume X) Chapter Y(.Z) | (Vol. X) Ch. Y(.Z)
	const result = /(?:Vol(?:\.|ume)\s*([0-9]+)?\s*)?(?:Ch(?:\.|apter)\s*([0-9]+(?:\.[0-9]+)?))?/.exec(chapter);
	// Broken ?
	if (result == null) return { chapter: NaN };
	const chapterValue = parseFloat(result[2]);
	const volume = parseInt(result[1]);
	const progress: Progress = {
		chapter: isNaN(chapterValue) ? -1 : chapterValue,
		volume: isNaN(volume) ? undefined : volume,
	};
	return progress;
}

export function getProgress(
	name: string | undefined,
	chapter: string | undefined,
	volume: string | undefined
): Progress {
	const oneshot = name?.toLocaleLowerCase() == 'oneshot';
	let progress: Progress = {
		chapter: oneshot ? 1 : parseFloat(chapter!),
		volume: parseInt(volume!),
		oneshot,
	};
	// Fallback to progress in chapter name
	if (isNaN(progress.chapter)) {
		if (name) {
			progress = progressFromString(name);
		} else progress.chapter = 0;
	}
	if (progress.volume !== undefined && isNaN(progress.volume)) {
		progress.volume = undefined;
	}
	return progress;
}

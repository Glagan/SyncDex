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

export function stringToProgress(str: string): Progress | undefined {
	// Handle Oneshot as chapter 0
	const progressReg: (string[] | null)[] = [
		/Vol(?:\.|ume)\s*(\d+)/.exec(str),
		/Ch(?:\.|apter)\s*(\d+(\.\d+)?)/.exec(str),
	];
	// Handle Oneshot as chapter 0
	if (progressReg[1] === null) {
		if (str != 'Oneshot') return undefined;
		progressReg[1] = ['Oneshot', '0'];
	}
	return {
		volume: progressReg[0] !== null ? parseInt(progressReg[0][1]) : undefined,
		chapter: parseFloat(progressReg[1][1]),
	};
}

export function progressToString(progress: Progress): string {
	const volume = progress.volume && progress.volume > 0 ? `Vol. ${progress.volume}` : '';
	return `${progress.oneshot ? 'Oneshot' : `${volume ? `${volume} Ch.` : 'Chapter'} ${progress.chapter}`}`;
}

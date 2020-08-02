export function zeroPad(n: number): string {
	return ('00' + n).slice(-2);
}

export function isDate(date?: any): date is Date {
	return date instanceof Date;
}

export function dateFormat(timestamp: number | Date): string {
	let d = typeof timestamp === 'object' ? timestamp : new Date(timestamp);
	return `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-${zeroPad(d.getDate())}`;
	// `${zeroPad(d.getHours())}:${zeroPad(d.getMinutes())}:${zeroPad(d.getSeconds())}`;
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

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

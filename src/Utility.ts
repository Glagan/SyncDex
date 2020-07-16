export function zeroPad(n: number): string {
	return ('00' + n).slice(-2);
}

export function dateFormat(timestamp: number): string {
	const d = new Date(timestamp);
	return `${d.getFullYear()}-${zeroPad(d.getMonth() + 1)}-${zeroPad(d.getDate())}`;
	// `${zeroPad(d.getHours())}:${zeroPad(d.getMinutes())}:${zeroPad(d.getSeconds())}`;
}

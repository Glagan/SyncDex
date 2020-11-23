import { browser } from 'webextension-polyfill-ts';
import { LocalStorage } from './Storage';

export namespace Log {
	export let logs: LogLine[] | undefined = undefined;
}
export async function loadLogs(reload: boolean = false): Promise<LogLine[]> {
	if (Log.logs === undefined || reload) {
		Log.logs = await LocalStorage.get('logs', []);
	}
	return Log.logs!;
}
export async function log(message: string | Error): Promise<LogLine> {
	const logs = await loadLogs();
	const line = { d: Date.now(), msg: typeof message === 'object' ? `${message}\nStack: ${message.stack}` : message };
	logs.push(line);
	if (logs.length > 250) logs.splice(0, logs.length - 250);
	// Do not use LocalStorage.set to avoid updating lastModified
	await browser.storage.local.set({ logs: logs });
	return line;
}

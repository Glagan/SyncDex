import { browser } from 'webextension-polyfill-ts';
import { Storage } from './Storage';

export namespace Log {
	export let logs: LogLine[] | undefined = undefined;
}
export async function loadLogs(reload: boolean = false): Promise<LogLine[]> {
	if (Log.logs === undefined || reload) {
		Log.logs = await Storage.get('logs', []);
	}
	return Log.logs!;
}
export async function log(message: string | Error): Promise<LogLine> {
	const logs = await loadLogs();
	const line = { d: Date.now() } as LogLine;
	if (typeof message === 'object') {
		if (message instanceof Error) {
			line.msg = `${message?.name}: ${message?.message}\nStack: ${message?.stack}`;
			console.error(message);
		} else line.msg = `Object: ${JSON.stringify(message)}`;
	} else line.msg = message;
	logs.push(line as LogLine);
	await Storage.set({ logs: logs });
	return line;
}

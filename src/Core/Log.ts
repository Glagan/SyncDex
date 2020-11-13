import { LocalStorage } from './Storage';

export interface LogLine {
	d: number;
	msg: string;
}

export namespace Log {
	export let logs: LogLine[] | undefined = undefined;
}
export async function loadLogs(reload: boolean = false): Promise<LogLine[]> {
	if (Log.logs === undefined || reload) {
		const storageLogs = await LocalStorage.get<LogLine[] | undefined>('logs');
		if (storageLogs !== undefined) Log.logs = storageLogs;
		else Log.logs = [];
	}
	return Log.logs!;
}
export async function log(message: string | Error): Promise<LogLine> {
	const logs = await loadLogs();
	const line = { d: Date.now(), msg: typeof message === 'object' ? `${message}\nStack: ${message.stack}` : message };
	logs.push(line);
	if (logs.length > 250) logs.splice(0, logs.length - 250);
	await LocalStorage.set('logs', logs);
	return line;
}

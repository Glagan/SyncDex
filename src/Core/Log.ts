import { LocalStorage } from './Storage';

let loadingLogs: Promise<undefined | string[]> | true = LocalStorage.get('logs');
export let logConsoleOutputDefault: boolean = false;
export let logs: string[] = [];
export async function log(str: string, consoleOutput?: boolean): Promise<void> {
	if (loadingLogs !== true) {
		const existingLogs = await loadingLogs;
		if (existingLogs !== undefined) logs = existingLogs;
		loadingLogs = true;
	}
	const date = new Date();
	if (consoleOutput == undefined ? consoleOutput : log.consoleOutputDefault) console.log(`${date} | ${str}`);
	logs.push(`${date} | ${str}`);
	if (logs.length > 250) logs.splice(0, logs.length - 250);
	LocalStorage.set('logs', logs);
}
log.consoleOutputDefault = false;

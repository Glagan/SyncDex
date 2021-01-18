import { browser } from 'webextension-polyfill-ts';
import { LogLevel, Options } from './Options';
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
export async function log(level: LogLevel, message: string | Error): Promise<LogLine | undefined>;
export async function log(message: string | Error): Promise<LogLine | undefined>;
export async function log(...args: any[]): Promise<LogLine | undefined> {
	let level = LogLevel.Default,
		message;
	if (args.length == 2) {
		message = args[1];
	} else message = args[0];
	if (level <= Options.logLevel) {
		const logs = await loadLogs();
		const line = { d: Date.now() } as LogLine;
		if (typeof message === 'object') {
			if (message instanceof Error) {
				line.msg = `${message?.name}: ${message?.message}\nStack: ${message?.stack}`;
				console.error(message);
			} else line.msg = `Object: ${JSON.stringify(message)}`;
		} else line.msg = message;
		console.log(line.msg);
		if (level <= LogLevel.ExecutionTime) {
			logs.push(line);
			await Storage.set(StorageUniqueKey.Logs, logs);
		}
		return line;
	}
	return undefined;
}
export function debug(message: string | Error) {
	return log(LogLevel.Debug, message);
}
export function LogCall(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
	const fct = descriptor.value;
	descriptor.value = function (...args: any[]) {
		if (Options.logLevel >= LogLevel.Debug) {
			log(LogLevel.Debug, `Called ${target.constructor.name}::${propertyKey}(${JSON.stringify(args)})`);
		}
		return fct.apply(this, args);
	};
	return descriptor;
}
export function TryCatch(callback?: (error: Error) => void) {
	return function (_target: Object, _propertyKey: string, descriptor: PropertyDescriptor) {
		const fct = descriptor.value;
		descriptor.value = function (...args: any[]) {
			try {
				return fct.apply(this, args);
			} catch (error) {
				if (callback) callback(error);
				log(error);
			}
		};
		return descriptor;
	};
}
export function LogExecTime(target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
	const fct = descriptor.value;
	descriptor.value = async function (...args: any[]) {
		const start = performance.now();
		const result = await fct.apply(this, args);
		if (Options.logLevel >= LogLevel.ExecutionTime) {
			await log(
				LogLevel.ExecutionTime,
				`${target.constructor.name}::${propertyKey} ~ Execution time: ${performance.now() - start}ms`
			);
		}
		return result;
	};
	return descriptor;
}

export enum MessageAction {
	fetch = 'fetch',
	openOptions = 'openOptions',
}

export interface FetchMessage {
	action: MessageAction.fetch;
	url: string;
	isJson?: boolean;
	with?: 'XHR' | 'fetch';
	options?: {
		method?: string;
		body?: string | null;
		headers?: { [key: string]: string };
		credentials?: RequestCredentials;
	};
}

export interface OpenOptionsMessage {
	action: MessageAction.openOptions;
}

export class Message {
	static send(message: FetchMessage | OpenOptionsMessage) {
		return browser.runtime.sendMessage(message);
	}
}

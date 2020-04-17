export enum MessageAction {
	request = 'request',
	openOptions = 'openOptions',
}

export interface RequestMessage {
	action: MessageAction.request;
	method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'DELETE' | 'PUT' | 'PATCH';
	url: string;
	isJson?: boolean;
	with?: 'XHR' | 'request';
	body?: string | null;
	headers?: { [key: string]: string };
	credentials?: RequestCredentials;
}

export interface FetchJSONMessage extends RequestMessage {
	isJson: true;
}

export interface OpenOptionsMessage {
	action: MessageAction.openOptions;
}

export type Message = RequestMessage | OpenOptionsMessage;

export interface Response {
	url: string;
	status: number;
	headers: Record<string, string>;
	body: Record<string, string> | string;
}

export interface JSONResponse extends Response {
	body: Record<string, any>;
}

export interface RawResponse extends Response {
	body: string;
}

export class Runtime {
	static sendMessage<T = any>(message: Message): Promise<T> {
		return browser.runtime.sendMessage(message);
	}

	static request<R extends Response>(message: Omit<RequestMessage, 'action'>): Promise<R> {
		return Runtime.sendMessage<R>(
			Object.assign(message, {
				action: MessageAction.request,
			})
		);
	}

	static openOptions(): Promise<void> {
		return Runtime.sendMessage({
			action: MessageAction.openOptions,
		});
	}
}

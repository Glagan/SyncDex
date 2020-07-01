export const enum RequestStatus {
	MISSING_TOKEN,
	SUCCESS,
	CREATED,
	FAIL,
	SERVER_ERROR,
	BAD_REQUEST,
	NOT_FOUND,
}

export enum MessageAction {
	request = 'request',
	openOptions = 'openOptions',
}

export interface FormDataFile {
	content: string[];
	name: string;
	options?: FilePropertyBag | undefined;
}

export interface FormDataProxy {
	[key: string]: string | number | FormDataFile;
}

export interface RequestMessage {
	action: MessageAction.request;
	method?: 'GET' | 'POST' | 'HEAD' | 'OPTIONS' | 'DELETE' | 'PUT' | 'PATCH';
	url: string;
	isJson?: boolean;
	body?: FormDataProxy | FormData | string | null;
	cache?: RequestCache;
	headers?: HeadersInit;
	redirect?: RequestRedirect;
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
	redirected: boolean;
	ok: boolean;
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

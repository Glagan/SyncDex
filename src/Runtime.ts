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

export class Runtime {
	static sendMessage<T extends RequestResponse | void>(message: Message): Promise<T> {
		return browser.runtime.sendMessage<T>(message);
	}

	static jsonRequest<T extends {} = Record<string, any>>(
		message: Omit<RequestMessage, 'action' | 'isJson'>
	): Promise<JSONResponse<T>> {
		return Runtime.sendMessage<JSONResponse<T>>(
			Object.assign(message, {
				action: MessageAction.request,
				isJson: true,
			})
		);
	}

	static request<R extends RequestResponse>(message: Omit<RequestMessage, 'action'>): Promise<R> {
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

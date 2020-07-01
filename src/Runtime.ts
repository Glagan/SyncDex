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
	static sendMessage<R extends RequestResponse | void>(message: Message): Promise<R> {
		return browser.runtime.sendMessage<R>(message);
	}

	static jsonRequest<R extends {} = Record<string, any>>(
		message: Omit<RequestMessage, 'action' | 'isJson'>
	): Promise<JSONResponse<R>> {
		return Runtime.sendMessage<JSONResponse<R>>(
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

	static responseStatus<R extends RequestResponse>(response: R): RequestStatus {
		if (response.code == 0) return RequestStatus.FAIL;
		else if (response.code >= 500) return RequestStatus.SERVER_ERROR;
		else if (response.code >= 400) return RequestStatus.BAD_REQUEST;
		return RequestStatus.SUCCESS;
	}
}

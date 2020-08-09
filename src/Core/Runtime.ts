export class Runtime {
	/**
	 * Send a message to the background running script.
	 */
	static sendMessage<R extends RequestResponse | void>(message: Message): Promise<R> {
		return browser.runtime.sendMessage<R>(message);
	}

	/**
	 * Send a fetch request with an expected JSON response.
	 */
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

	/**
	 * Send a fetch request.
	 */
	static request<R extends RequestResponse>(message: Omit<RequestMessage, 'action'>): Promise<R> {
		return Runtime.sendMessage<R>(
			Object.assign(message, {
				action: MessageAction.request,
			})
		);
	}

	/**
	 * Open a new tab of the Options page.
	 */
	static openOptions(): Promise<void> {
		return Runtime.sendMessage({
			action: MessageAction.openOptions,
		});
	}

	/**
	 * Return the response.code corresponding RequestStatus code.
	 */
	static responseStatus<R extends RequestResponse>(response: R): RequestStatus {
		if (response.code == 0) return RequestStatus.FAIL;
		else if (response.code >= 500) return RequestStatus.SERVER_ERROR;
		else if (response.code == 404) return RequestStatus.NOT_FOUND;
		else if (response.code >= 400) return RequestStatus.BAD_REQUEST;
		return RequestStatus.SUCCESS;
	}

	static file(path: string): string {
		return browser.runtime.getURL(path);
	}

	static icon(icon: string): string {
		return Runtime.file(`/icons/${icon}.png`);
	}
}
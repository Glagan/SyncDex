import { browser } from 'webextension-polyfill-ts';
import { log } from './Log';

export class Runtime {
	static messageSender: (message: Message) => any = browser.runtime.sendMessage;

	/**
	 * Send a message to the background running script.
	 */
	static async sendMessage<R extends RequestResponse | void>(message: Message): Promise<R> {
		return Runtime.messageSender(message);
	}

	/**
	 * Send a fetch request with an expected JSON response.
	 */
	static async jsonRequest<R extends {} = Record<string, any>>(
		message: Omit<RequestMessage, 'action' | 'isJson'>
	): Promise<JSONResponse<R>> {
		try {
			return Runtime.sendMessage<JSONResponse<R>>(
				Object.assign(message, {
					action: MessageAction.request,
					isJson: true,
				})
			);
		} catch (error) {
			await log(`Error in Runtime.jsonRequest: ${error}`);
			return {
				url: message.url,
				ok: false,
				failed: true,
				code: 0,
				redirected: false,
				headers: {},
				body: {} as R,
			};
		}
	}

	/**
	 * Send a fetch request.
	 */
	static async request<R extends RequestResponse = RawResponse>(message: Omit<RequestMessage, 'action'>): Promise<R> {
		try {
			return Runtime.sendMessage<R>(
				Object.assign(message, {
					action: MessageAction.request,
				})
			);
		} catch (error) {
			await log(`Error in Runtime.request: ${error}`);
			return {
				url: message.url,
				ok: false,
				failed: true,
				code: 0,
				redirected: false,
				headers: {},
				body: message.isJson ? {} : '',
			} as R;
		}
	}

	/**
	 * Open a new tab of the Options page.
	 */
	static async openOptions(): Promise<void> {
		try {
			return Runtime.sendMessage({
				action: MessageAction.openOptions,
			});
		} catch (error) {
			await log(`Could not open Options with Runtime.openOptions: ${error}`);
		}
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

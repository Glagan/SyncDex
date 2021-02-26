import { browser } from 'webextension-polyfill-ts';
import { log } from './Log';
import { Message } from './Message';

export class Request {
	static buildQuery(params: { [key: string]: any }, doBody: boolean = true): string {
		return Object.keys(params)
			.map((f) => `${encodeURIComponent(f)}=${doBody ? encodeURIComponent(params[f]) : params[f]}`)
			.join('&');
	}

	/**
	 * Send a fetch request with an expected JSON response.
	 */
	static async json<R extends {} = Record<string, any>>(
		message: Omit<RequestMessage, 'action' | 'isJson'>
	): Promise<JSONResponse<R>> {
		try {
			return Message.send<JSONResponse<R>>(
				Object.assign(message, {
					action: MessageAction.request,
					isJson: true,
				})
			);
		} catch (error) {
			await log(`Error in Request.json: ${error}`);
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
	static async get<R extends RequestResponse = RawResponse>(message: Omit<RequestMessage, 'action'>): Promise<R> {
		try {
			return Message.send<R>(
				Object.assign(message, {
					action: MessageAction.request,
				})
			);
		} catch (error) {
			await log(`Error in Request.get: ${error}`);
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
	 * Return the response.code corresponding RequestStatus code.
	 */
	static status<R extends RequestResponse>(response: R): RequestStatus {
		if (response.code == 0) return RequestStatus.FAIL;
		else if (response.code >= 500) return RequestStatus.SERVER_ERROR;
		else if (response.code == 404) return RequestStatus.NOT_FOUND;
		else if (response.code >= 400) return RequestStatus.BAD_REQUEST;
		return RequestStatus.SUCCESS;
	}
}

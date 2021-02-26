import { browser } from 'webextension-polyfill-ts';

export class Message {
	static messageSender: (message: MessagePayload) => any = browser.runtime.sendMessage;

	/**
	 * Send a message to the background running script.
	 */
	static async send<R extends RequestResponse | void>(message: MessagePayload): Promise<R> {
		return Message.messageSender(message);
	}
}

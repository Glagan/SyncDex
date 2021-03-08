import { browser } from 'webextension-polyfill-ts';

export namespace Message {
	/**
	 * ? Delete ?
	 * Modifiable sender to send local messages in background script.
	 */
	export let sender: <K extends keyof MessageDescriptions>(
		message: MessagePayload<K>
	) => Promise<MessageResponse<K>> = browser.runtime.sendMessage;

	/**
	 * Send a message to the background running script.
	 */
	export function send<K extends keyof MessageDescriptions>(
		...params: MessageParams<K>
	): Promise<MessageResponse<K>> {
		if (params.length == 2) {
			// payload: params[1] is always an object if present
			return sender({ ...(params[1] as any), action: params[0] });
		}
		return sender({ action: params[0] } as MessagePayload<K>);
	}
}

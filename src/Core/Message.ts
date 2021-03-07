import { browser } from 'webextension-polyfill-ts';

export namespace Message {
	/**
	 * Send a message to the background running script.
	 */
	export function send<K extends keyof MessageDescriptions>(
		...params: MessageParams<K>
	): Promise<MessageResponse<K>> {
		if (params.length == 2) {
			// payload: params[1] is always an object if present
			return browser.runtime.sendMessage({ ...(params[1] as any), action: params[0] });
		}
		return browser.runtime.sendMessage({ action: params[0] } as MessagePayload<K>);
	}
}

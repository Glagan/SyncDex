import { browser } from 'webextension-polyfill-ts';

/// @ts-ignore
export const isChrome = window.chrome && window.browser === undefined;

export function setIcon(title: string = '', bgColor: string = '', text: string = '') {
	if (!isChrome) {
		browser.browserAction.setTitle({ title: title });
		browser.browserAction.setBadgeBackgroundColor({ color: bgColor == '' ? null : bgColor });
		browser.browserAction.setBadgeText({ text: text });
	}
}

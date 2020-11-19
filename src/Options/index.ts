import { browser } from 'webextension-polyfill-ts';
import { DOM } from '../Core/DOM';
import { Modal } from '../Core/Modal';
import { Options } from '../Core/Options';
import { LocalStorage } from '../Core/Storage';
import { Changelog } from './Changelog';
import { OptionsManager } from './OptionsManager';
import { ThemeHandler } from './ThemeHandler';

(async () => {
	ThemeHandler.bind();
	SimpleNotification._options.position = 'bottom-left';
	await Options.load();
	OptionsManager.instance = new OptionsManager();
	// Check current import progress
	const importInProgress = !!(await LocalStorage.get<boolean>('importInProgress'));
	OptionsManager.instance.toggleImportProgressState(importInProgress);

	// Check if SyncDex was updated or installed
	const reason = window.location.hash.substr(1);
	if (reason === 'install') {
		const modal = new Modal('medium');
		modal.header.textContent = 'Thank you for installing SyncDex !';
		DOM.append(
			modal.body,
			DOM.create('p', {
				class: 'paragraph',
				textContent: `It is recommended that you look at the options to enable (or disable) functionalities you don't want, or to customize colors.`,
			}),
			DOM.create('p', {
				class: 'paragraph',
				textContent: `If you want a new feature or found a bug, `,
				childs: [
					DOM.create('a', {
						href: 'https://github.com/Glagan/SyncDex/issues',
						textContent: 'Open an issue',
						childs: [DOM.space(), DOM.icon('external-link-alt')],
					}),
					DOM.text('.'),
				],
			})
		);
		modal.show();
	} else if (reason === 'update') {
		Changelog.openModal(true);
	}

	// Toggle import buttons when starting/ending an import
	browser.runtime.onMessage.addListener((message: Message): void => {
		if (message.action == MessageAction.importStart) {
			OptionsManager.instance.toggleImportProgressState(true);
		} else if (message.action == MessageAction.importComplete) {
			OptionsManager.instance.toggleImportProgressState(false);
		}
	});
})();

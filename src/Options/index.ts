import { browser } from 'webextension-polyfill-ts';
import { DOM } from '../Core/DOM';
import { Modal } from '../Core/Modal';
import { Options } from '../Core/Options';
import { SaveSync } from '../Core/SaveSync';
import { LocalStorage } from '../Core/Storage';
import { Changelog } from './Changelog';
import { OptionsManager } from './OptionsManager';
import { ThemeHandler } from './ThemeHandler';

console.log('SyncDex :: Options Manager');

// Generate a simple Modal with all options and logs
const quickDebug = document.getElementById('quickOptionsDebug');
if (quickDebug) {
	quickDebug.addEventListener('click', async (event) => {
		event.preventDefault();
		const save: ExportedSave = await browser.storage.local.get(null);
		delete save.history;
		// Remove all titles
		for (const key in save) {
			const id = parseInt(key);
			if (!isNaN(id)) delete save[key];
		}
		// Remove tokens
		if (save.options?.tokens) {
			for (const key in save.options.tokens) {
				(save.options.tokens as any)[key] = 'set';
			}
		}
		// Remove Save Sync tokens
		if (save.saveSync) {
			save.saveSync.token = save.saveSync.token ? 'set' : 'missing';
			save.saveSync.refresh = save.saveSync.refresh ? 'set' : 'missing';
		}
		const modal = new Modal('small');
		modal.header.textContent = 'Options and Logs';
		const input = DOM.create('textarea', {
			value: JSON.stringify(save),
			css: { width: '100%' },
			rows: 8,
			events: {
				click: (event) => {
					event.preventDefault();
					input.select();
				},
			},
		});
		DOM.append(modal.body, DOM.message('default', 'Copy/paste the content of the input below.'), input);
		modal.footer.classList.add('right');
		modal.footer.appendChild(
			DOM.create('button', {
				class: 'default',
				textContent: 'Close',
				events: {
					click: (event) => {
						event.preventDefault();
						modal.remove();
					},
				},
			})
		);
		modal.show();
	});
}

(async () => {
	ThemeHandler.bind();
	SimpleNotification._options.position = 'bottom-left';
	await Options.load();
	const versionSpan = document.getElementById('version');
	if (versionSpan) versionSpan.textContent = `${Options.version}.${Options.subVersion}`;
	SaveSync.state = await LocalStorage.get('saveSync');
	OptionsManager.instance = new OptionsManager();
	// Check current import progress
	const progress = await LocalStorage.raw('get', ['importInProgress', 'saveSyncInProgress']);
	OptionsManager.instance.toggleImportProgressState(progress.importInProgress || progress.saveSyncInProgress);

	// Check if SyncDex was updated or installed
	const reason = window.location.hash.substr(1);
	if (reason === 'install') {
		const modal = new Modal('medium');
		modal.header.textContent = 'Thank you for installing SyncDex !';
		DOM.append(
			modal.body,
			DOM.message(
				'warning',
				`SyncDex is still in beta, don't be afraid to open issues on Github, or contact me (see SUPPORT.md on Github) ! You can find the link on the left.`
			),
			DOM.message(
				'info',
				`To start using SyncDex you need to enable Services, and you can initialize your local list by Importing it from the service you activated !`
			),
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
		const syncEnded = message.action == MessageAction.saveSyncComplete;
		if (message.action == MessageAction.importStart || message.action == MessageAction.saveSyncStart) {
			OptionsManager.instance.toggleImportProgressState(true);
		} else if (message.action == MessageAction.importComplete || syncEnded) {
			OptionsManager.instance.toggleImportProgressState(false);
		}
		if (message.action == MessageAction.saveSyncComplete) {
			if (message.status == SaveSyncResult.ERROR) {
				SimpleNotification.error({ text: `Save Sync failed, check logs.` });
			}
			OptionsManager.instance.reload();
		}
	});
})();

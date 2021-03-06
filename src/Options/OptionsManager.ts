import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/Highlights';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';
import { ServiceManager } from './Manager/Service';
import { Storage } from '../Core/Storage';
import { SaveViewer } from './SaveViewer';
import { Options } from '../Core/Options';
import { Changelog } from './Changelog';
import { MyMangaDex } from './SpecialService/MyMangaDex';
import { SyncDexImport, SyncDexExport } from './SpecialService/SyncDex';
import { MangaDexImport, MangaDexExport } from './SpecialService/MangaDex';
import { SpecialService } from './SpecialService';
import { Logs } from './Logs';
import { SaveSyncManager } from './Manager/SaveSync';
import { Log } from '../Core/Log';

export class OptionsManager {
	highlightsManager: HighlightsManager;
	colorManager: ColorManager;
	checkboxManager: CheckboxManager;
	inputManager: InputManager;
	menuHighlight: MenuHighlight;
	serviceManager: ServiceManager;
	saveViewer: SaveViewer;
	saveSync: SaveSyncManager;
	logs: Logs;
	importExportCards: HTMLElement[] = [];
	// Instance of the OptionsManager to use in ReloadOptions
	static instance: OptionsManager;

	constructor() {
		this.highlightsManager = new HighlightsManager();
		this.colorManager = new ColorManager();
		this.checkboxManager = new CheckboxManager();
		this.inputManager = new InputManager();
		this.menuHighlight = new MenuHighlight();
		this.serviceManager = new ServiceManager();
		this.saveViewer = SaveViewer.instance;
		this.saveSync = new SaveSyncManager();
		this.logs = new Logs();

		// Import/Export
		const cardIds: { [key: string]: typeof SpecialService } = {
			'import-mymangadex': MyMangaDex,
			'import-syncdex': SyncDexImport,
			'import-mangadex': MangaDexImport,
			'export-syncdex': SyncDexExport,
			'export-mangadex': MangaDexExport,
		};
		for (const cardId in cardIds) {
			const card = document.getElementById(cardId);
			if (card) {
				this.importExportCards.push(card);
				card.addEventListener('click', (event) => {
					event.preventDefault();
					if (!card.classList.contains('disabled')) {
						/// @ts-ignore className is *NOT* abstract
						new cardIds[cardId]().start();
					}
				});
			}
		}

		// Delete save event
		const deleteSave = document.getElementById('delete-save');
		if (deleteSave) {
			let clearClickCount = 0;
			let clickCount = 0;
			let notification: SimpleNotification;
			deleteSave.addEventListener('click', async () => {
				if (clickCount == 1) {
					window.clearTimeout(clearClickCount);
					deleteSave.classList.add('loading');
					if (notification) notification.remove();
					Log.logs = [];
					await Storage.clear();
					Options.reset();
					await Options.save();
					this.saveSync.toggleButtons(false);
					this.saveSync.toggleImportProgressState(false);
					this.reload();
					clickCount = 0;
					deleteSave.classList.remove('loading');
					deleteSave.style.fontSize = '15px';
				} else {
					deleteSave.style.fontSize = '22px';
					++clickCount;
					// Clear clickCount after 4s, just in case
					notification = SimpleNotification.info(
						{ text: 'Click **Delete** again to confirm' },
						{ duration: 4000, pauseOnHover: false }
					);
					window.clearTimeout(clearClickCount);
					clearClickCount = window.setTimeout(() => {
						notification.remove();
						clickCount = 0;
						deleteSave.style.fontSize = '15px';
					}, 4000);
				}
			});
		}

		// Changelog button
		const changelogLink = document.getElementById('open-changelog');
		if (changelogLink) {
			changelogLink.addEventListener('click', (event) => {
				event.preventDefault();
				Changelog.openModal(false);
			});
		}
	}

	toggleImportProgressState(value: boolean) {
		this.saveSync.toggleImportProgressState(value);
		this.serviceManager.toggleImportProgressState(value);
		if (value) {
			for (const card of this.importExportCards) {
				card.title = 'Import in Progress, wait for it to finish.';
				card.classList.add('disabled');
			}
		} else {
			for (const card of this.importExportCards) {
				card.title = '';
				card.classList.remove('disabled');
			}
		}
	}

	reload() {
		this.highlightsManager.updateAll();
		this.colorManager.updateAll();
		this.checkboxManager.updateAll();
		this.inputManager.updateAll();
		this.serviceManager.refreshActive();
		this.saveViewer.updateAll(true);
		this.saveSync.refresh();
		this.logs.reload();
	}
}

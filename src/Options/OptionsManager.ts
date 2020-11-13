import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/Highlights';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';
import { ServiceManager } from './Manager/Service';
import { LocalStorage } from '../Core/Storage';
import { SaveViewer } from './SaveViewer';
import { SaveOptions } from './Utility';
import { Options } from '../Core/Options';
import { Changelog } from './Changelog';
import { MyMangaDex } from './MyMangaDex';
import { SyncDexImport, SyncDexExport } from './SyncDex';
import { MangaDexImport, MangaDexExport } from './MangaDex';
import { SpecialService } from './SpecialService';
import { Logs } from './Logs';

export class OptionsManager {
	highlightsManager: HighlightsManager;
	colorManager: ColorManager;
	checkboxManager: CheckboxManager;
	inputManager: InputManager;
	menuHighlight: MenuHighlight;
	serviceManager: ServiceManager;
	saveViewer: SaveViewer;
	logs: Logs;
	// Instance of the OptionsManager to use in ReloadOptions
	static instance: OptionsManager;

	constructor() {
		this.highlightsManager = new HighlightsManager();
		this.colorManager = new ColorManager();
		this.checkboxManager = new CheckboxManager();
		this.inputManager = new InputManager();
		this.menuHighlight = new MenuHighlight();
		this.serviceManager = new ServiceManager();
		this.saveViewer = new SaveViewer();
		this.logs = new Logs();

		// Import
		const importCards: { [key: string]: typeof SpecialService } = {
			'import-mymangadex': MyMangaDex,
			'import-syncdex': SyncDexImport,
			'import-mangadex': MangaDexImport,
			'export-syncdex': SyncDexExport,
			'export-mangadex': MangaDexExport,
		};
		for (const cardId in importCards) {
			const card = document.getElementById(cardId);
			if (card) {
				card.addEventListener('click', (event) => {
					event.preventDefault();
					/// @ts-ignore className is *NOT* abstract
					new importCards[cardId]().start();
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
					await LocalStorage.clear();
					Options.reset();
					await SaveOptions();
					this.reload();
					clickCount = 0;
					deleteSave.classList.remove('loading');
					deleteSave.style.fontSize = '15px';
				} else {
					deleteSave.style.fontSize = '22px';
					++clickCount;
					// Clear clickCount after 4s, just in case
					notification = SimpleNotification.info(
						{
							text: 'Click **Delete** again to confirm',
						},
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

	reload = (): void => {
		this.highlightsManager.updateAll();
		this.colorManager.updateAll();
		this.checkboxManager.updateAll();
		this.inputManager.updateAll();
		this.serviceManager.refreshActive();
		this.saveViewer.updateAll(true);
		this.logs.reload();
	};
}

import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/Highlights';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';
import { ServiceManager } from './Manager/Service';
import { LocalStorage } from '../Core/Storage';
import { SaveViewer } from './SaveViewer';
import { ImportExportManager } from './Manager/ImportExport';
import { SaveOptions } from './Utility';
import { Options } from '../Core/Options';

export class OptionsManager {
	highlightsManager: HighlightsManager;
	colorManager: ColorManager;
	checkboxManager: CheckboxManager;
	inputManager: InputManager;
	menuHighlight: MenuHighlight;
	serviceManager: ServiceManager;
	importExport: ImportExportManager;
	saveViewer: SaveViewer;
	// Instance of the OptionsManager to use in ReloadOptions
	static instance: OptionsManager;

	constructor() {
		this.highlightsManager = new HighlightsManager();
		this.colorManager = new ColorManager();
		this.checkboxManager = new CheckboxManager();
		this.inputManager = new InputManager();
		this.menuHighlight = new MenuHighlight();
		this.serviceManager = new ServiceManager();
		this.importExport = new ImportExportManager();
		this.saveViewer = new SaveViewer();
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
					// Clear clickCount after 2s, just in case
					notification = SimpleNotification.info(
						{
							text: 'Click **Delete** again to confirm',
						},
						{ position: 'bottom-left', duration: 4000 }
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
		// Change theme button
		const prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
		const themeRow = document.getElementById('switch-theme')!;
		const themeButton = themeRow.querySelector('i')!;
		if (prefersColorScheme.matches) {
			document.body.classList.add('dark');
			themeButton.className = 'fas fa-sun';
		}
		const toggleTheme = (): void => {
			themeButton.classList.toggle('fa-sun');
			themeButton.classList.toggle('fa-moon');
			document.body.classList.toggle('dark');
			document.body.classList.toggle('light');
		};
		themeRow.addEventListener('click', toggleTheme);
		prefersColorScheme.addEventListener('change', toggleTheme);
	}

	reload = (): void => {
		this.highlightsManager.updateAll();
		this.colorManager.updateAll();
		this.checkboxManager.updateAll();
		this.inputManager.updateAll();
		this.serviceManager.refreshActive();
		this.saveViewer.updateAll();
	};
}
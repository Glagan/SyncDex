import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';
import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/Highlights';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';
import { ServiceManager } from './Manager/Service';
import { LocalStorage } from '../src/Storage';
import { SaveViewer } from './SaveViewer';

class OptionsManager {
	highlightsManager?: HighlightsManager;
	colorManager?: ColorManager;
	checkboxManager?: CheckboxManager;
	inputManager?: InputManager;
	menuHighlight?: MenuHighlight;
	serviceManager?: ServiceManager;
	saveViewer?: SaveViewer;

	execute = async (): Promise<void> => {
		await Options.load();
		this.highlightsManager = new HighlightsManager();
		this.colorManager = new ColorManager();
		this.checkboxManager = new CheckboxManager();
		this.inputManager = new InputManager();
		this.menuHighlight = new MenuHighlight();
		this.serviceManager = new ServiceManager();
		this.saveViewer = new SaveViewer();
		// Delete save event
		const deleteSave = document.getElementById('delete-save');
		if (deleteSave) {
			let clearClickCount = 0;
			let clickCount = 0;
			deleteSave.addEventListener('click', async () => {
				if (clickCount == 1) {
					window.clearTimeout(clearClickCount);
					deleteSave.classList.add('loading');
					await LocalStorage.clear();
					Options.reset();
					await Options.save();
					this.reload();
					clickCount = 0;
					deleteSave.classList.remove('loading');
					deleteSave.style.fontSize = 'var(--body-20)';
				} else {
					deleteSave.style.fontSize = 'var(--title-30)';
					++clickCount;
					// Clear clickCount after 2s, just in case
					window.clearTimeout(clearClickCount);
					clearClickCount = window.setTimeout(() => {
						clickCount = 0;
						deleteSave.style.fontSize = 'var(--body-20)';
					}, 4000);
				}
			});
		}
		// Change theme button
		const prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
		const themeRow = document.getElementById('switch-theme') as HTMLElement;
		const themeButton = themeRow.querySelector('i') as HTMLElement;
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
	};

	reload = (): void => {
		this.highlightsManager?.updateAll();
		this.colorManager?.updateAll();
		this.checkboxManager?.updateAll();
		this.inputManager?.updateAll();
		this.serviceManager?.refreshActive();
		this.saveViewer?.updateAll();
	};
}

setBrowser();
const manager = new OptionsManager();
manager.execute();

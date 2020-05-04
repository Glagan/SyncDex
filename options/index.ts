import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';
import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/Highlights';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';
import { ServiceManager } from './Manager/Service';
import { LocalStorage } from '../src/Storage';

class OptionsManager {
	highlightsManager?: HighlightsManager;
	colorManager?: ColorManager;
	checkboxManager?: CheckboxManager;
	inputManager?: InputManager;
	menuHighlight?: MenuHighlight;
	serviceManager?: ServiceManager;

	execute = async (): Promise<void> => {
		// await LocalStorage.clear();
		await Options.load();
		this.highlightsManager = new HighlightsManager();
		this.colorManager = new ColorManager();
		this.checkboxManager = new CheckboxManager();
		this.inputManager = new InputManager();
		this.menuHighlight = new MenuHighlight(document.getElementById('content') as HTMLElement);
		this.serviceManager = new ServiceManager(
			document.getElementById('service-list') as HTMLElement,
			document.getElementById('save-container') as HTMLElement
		);
		// Delete save
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
					deleteSave.style.fontSize = '1rem';
				} else {
					deleteSave.style.fontSize = '2rem';
					++clickCount;
					// Clear clickCount after 2s, just in case
					window.clearTimeout(clearClickCount);
					clearClickCount = window.setTimeout(() => {
						clickCount = 0;
						deleteSave.style.fontSize = '1rem';
					}, 2000);
				}
			});
		}
	};

	reload = (): void => {
		this.highlightsManager?.updateAll();
		this.colorManager?.updateAll();
		this.checkboxManager?.updateAll();
		this.inputManager?.updateAll();
		this.serviceManager?.refreshActive();
	};
}

setBrowser();
const manager = new OptionsManager();
manager.execute();

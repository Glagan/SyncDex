import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';
import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/Highlights';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';
import { ServiceManager } from './Manager/Service';
import { SaveImportManager, SaveExportManager } from './Manager/Save';

class OptionsManager {
	options: Options = new Options();

	highlightsManager?: HighlightsManager;
	colorManager?: ColorManager;
	checkboxManager?: CheckboxManager;
	inputManager?: InputManager;
	menuHighlight?: MenuHighlight;
	serviceManager?: ServiceManager;
	importManager?: SaveImportManager;
	exportManager?: SaveExportManager;

	initialize = async (): Promise<void> => {
		await this.options.load();
		// console.log(this.options);
		this.highlightsManager = new HighlightsManager(this.options);
		this.colorManager = new ColorManager(this.options);
		this.checkboxManager = new CheckboxManager(this.options);
		this.inputManager = new InputManager(this.options);
		this.menuHighlight = new MenuHighlight(document.getElementById('content') as HTMLElement);
		this.serviceManager = new ServiceManager(
			document.getElementById('service-list') as HTMLElement,
			this.options
		);
		this.importManager = new SaveImportManager(
			document.getElementById('import-container') as HTMLElement,
			this.options
		);
		this.exportManager = new SaveExportManager(
			document.getElementById('export-container') as HTMLElement,
			this.options
		);
	};

	reload = (): void => {};
}

setBrowser();
const manager = new OptionsManager();
manager.initialize();

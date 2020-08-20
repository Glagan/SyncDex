import { setBrowser } from '../Core/Browser';
import { Options } from '../Core/Options';
import { OptionsManager } from './OptionsManager';

setBrowser();
(async () => {
	SimpleNotification._options.position = 'bottom-left';
	await Options.load();
	OptionsManager.instance = new OptionsManager();
})();

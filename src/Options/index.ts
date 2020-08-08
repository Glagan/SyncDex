import { setBrowser } from '../Core/Browser';
import { Options } from '../Core/Options';
import { OptionsManager } from './OptionsManager';

setBrowser();
(async () => {
	await Options.load();
	OptionsManager.instance = new OptionsManager();
})();

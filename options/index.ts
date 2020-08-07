import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';
import { OptionsManager } from './OptionsManager';

setBrowser();
(async () => {
	await Options.load();
	OptionsManager.instance = new OptionsManager();
})();

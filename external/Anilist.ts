import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';

console.log('SyncDex :: Anilist Token');

(async () => {
	setBrowser();
	await Options.load();
	// Search token in URL
	let found = /access_token=(.+)&token_type=Bearer/.exec(window.location.href);
	if (found) {
		Options.tokens.anilistToken = found[1];
		await Options.save();
		console.log('Token saved !');
		// SimpleNotification.success("Token saved", "You can now close this page.", undefined, {
		// 	position: "bottom-left", sticky: true,
		// });
	} else {
		// SimpleNotification.error("Token not saved", "There was an error while saving the token.");
	}
})();

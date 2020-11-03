import { setBrowser } from '../Core/Browser';
import { Options } from '../Core/Options';

console.log('SyncDex :: Anilist Token');

(async () => {
	setBrowser();
	await Options.load();
	// Search token in URL
	const found = /access_token=(.+)&token_type=Bearer/.exec(window.location.href);
	// Always display notifications here
	if (found) {
		Options.tokens.anilistToken = found[1];
		await Options.save();
		SimpleNotification.success(
			{
				title: 'Token saved',
				text: 'You can now close this page and press **Refresh** in the **Anilist Card**.',
			},
			{ sticky: true }
		);
	} else {
		SimpleNotification.error(
			{
				title: 'Token not saved',
				text: 'There was an error while saving the token.',
			},
			{ sticky: true }
		);
	}
})();

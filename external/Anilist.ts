import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';

console.log('SyncDex :: Anilist Token');

(async () => {
	setBrowser();
	await Options.load();
	// Search token in URL
	let found = /access_token=(.+)&token_type=Bearer/.exec(window.location.href);
	// Always display notifications here
	if (found) {
		Options.tokens.anilistToken = found[1];
		await Options.save();
		SimpleNotification.success(
			{
				title: 'Token saved',
				text: 'You can now close this page.',
			},
			{ sticky: true }
		);
	} else {
		SimpleNotification.error({
			title: 'Token not saved',
			text: 'There was an error while saving the token.',
		});
	}
})();

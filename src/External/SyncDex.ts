import { browser } from 'webextension-polyfill-ts';

console.log('SyncDex :: Save Sync Token');

(async () => {
	const query: { [key: string]: string } = {};
	const queryString = window.location.search.substring(1);
	queryString
		.split('&')
		.map((s) => s.split('='))
		.forEach((s) => (query[s[0]] = s[1]));
	if (query.for && query.for != '') {
		// Convert received Hash (for Google Drive) to query to have a single entry point
		if (window.location.hash != '') {
			window.location.hash
				.substring(1)
				.split('&')
				.map((s) => s.split('='))
				.forEach((s) => (query[s[0]] = s[1]));
		}
		window.location.href = `${browser.runtime.getURL('/options/index.html')}?${Object.keys(query)
			.map((key) => {
				return `${key}=${query[key]}`;
			})
			.join('&')}`;
	} else {
		SimpleNotification.error(
			{ title: 'Huh ?', text: `**SyncDex** didn't found a **Save Sync Service** to redirect to.` },
			{ sticky: true }
		);
	}
})();

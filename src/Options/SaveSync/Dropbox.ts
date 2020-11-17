import { DOM } from '../../Core/DOM';
import { Runtime } from '../../Core/Runtime';
import { LocalStorage } from '../../Core/Storage';
import { generateRandomString, pkceChallengeFromVerifier } from '../PKCEHelper';
import { SaveSync } from '../SaveSync';

type DropboxState = { state: string; verifier: string };
type DropboxToken = {
	service: 'Dropbox';
	token: string;
	expires: number;
	refresh: string;
};

// Dropbox retrieve save
// Each line is a request
// 1. list files
// 2. check if there is a save.json file
// 	3. download it with it's id if it's more recent
//	 4. update remote file with the local save if it's not more recent
//	3. create a newfile with the local save if it doesn't exists
export class Dropbox extends SaveSync {
	static CLIENT_ID = 'd8aw9vtzpdqg93y';
	static REDIRECT_URI = `${Runtime.file('options/index.html')}?for=Dropbox`;

	card = async (node: HTMLButtonElement) => {
		node.classList.add('loading');
		const state = generateRandomString();
		const codeVerifier = generateRandomString();
		const codeChallenge = await pkceChallengeFromVerifier(codeVerifier);
		await LocalStorage.set('dropboxState', { state: state, verifier: codeVerifier });
		const url = `https://www.dropbox.com/oauth2/authorize?${Runtime.buildQuery({
			response_type: 'code',
			client_id: Dropbox.CLIENT_ID,
			state: state,
			redirect_uri: Dropbox.REDIRECT_URI,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256',
			token_access_type: 'offline',
		})}`;
		window.location.href = url;
	};

	manage = (parent: HTMLElement): void => {
		const refresh = DOM.create('button', { class: 'primary', textContent: 'Refresh' });
		refresh.addEventListener('click', (event) => {
			event.preventDefault();
			this.refresh();
		});
		parent.appendChild(refresh);
	};

	handleTokenResponse = async (response: RawResponse): Promise<boolean> => {
		try {
			const body = JSON.parse(response.body);
			if (response.ok) {
				SimpleNotification.success({ text: `Connected to **Dropbox**` });
				await LocalStorage.set('saveSync', {
					service: 'Dropbox',
					token: body.access_token,
					expires: Date.now() + body.expires_in * 1000,
					refresh: body.refresh_token,
				});
				return true;
			}
			SimpleNotification.error({
				title: 'API Error',
				text: `The API to retrieve a token returned an error: ${body.error}\n${body.error_description}`,
			});
		} catch (error) {
			SimpleNotification.error({ title: 'API Error', text: 'Could not parse a body from the Dropbox API.' });
		}
		return false;
	};

	refresh = async (): Promise<boolean> => {
		const dropbox: DropboxToken | undefined = await LocalStorage.get<DropboxToken>('saveSync');
		if (!dropbox) return false;
		const response = await Runtime.request<RawResponse>({
			method: 'POST',
			url: 'https://api.dropboxapi.com/oauth2/token',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: Runtime.buildQuery({
				grant_type: 'refresh_token',
				refresh_token: dropbox.refresh,
				client_id: Dropbox.CLIENT_ID,
			}),
		});
		return this.handleTokenResponse(response);
	};

	login = async (query: { [key: string]: string }): Promise<boolean> => {
		const dropboxState: DropboxState | undefined = await LocalStorage.get<DropboxState>('dropboxState');
		await LocalStorage.remove('dropboxState');
		if (query.error) {
			SimpleNotification.error(
				{
					title: 'API Error',
					text: `The API to retrieve a code returned an error: ${query.error}\n${query.error_description}`,
				},
				{ sticky: true }
			);
		} else if (dropboxState == undefined || dropboxState.state !== query.state) {
			SimpleNotification.error(
				{
					title: 'State Error',
					text: `A code to generate a token was received but there is no saved state or it is invalid, try again.`,
				},
				{ sticky: true }
			);
		} else {
			const response = await Runtime.request<RawResponse>({
				method: 'POST',
				url: 'https://api.dropboxapi.com/oauth2/token',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: Runtime.buildQuery({
					grant_type: 'authorization_code',
					code: query.code,
					client_id: Dropbox.CLIENT_ID,
					redirect_uri: Dropbox.REDIRECT_URI,
					code_verifier: dropboxState.verifier,
				}),
			});
			return this.handleTokenResponse(response);
		}
		return false;
	};
}

import { DOM } from '../../Core/DOM';
import { Runtime } from '../../Core/Runtime';
import { LocalStorage } from '../../Core/Storage';
import { SaveSyncManager } from '../Manager/SaveSync';
import { generateRandomString, pkceChallengeFromVerifier } from '../PKCEHelper';
import { SaveSync, SaveSyncState } from '../SaveSync';

type DropboxState = { state: string; verifier: string };
type DropboxFile = {
	'.tag': string;
	id: string;
	name: string;
	content_hash: string;
	rev: string;
	client_modified: string;
	server_modified: string;
	is_downloadable: true;
	path_display: string;
	path_lower: string;
	size: number;
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

	createCard = (): HTMLButtonElement => {
		return DOM.create('button', { childs: [DOM.icon('b', 'dropbox'), DOM.space(), DOM.text('Dropbox')] });
	};

	onCardClick = async (node: HTMLButtonElement) => {
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

	manage = (manager: SaveSyncManager, parent: HTMLElement): void => {
		const summary = DOM.create('p', {
			childs: [
				DOM.text('Logged in on'),
				DOM.space(),
				DOM.create('b', { childs: [DOM.icon('b', 'dropbox'), DOM.space(), DOM.text('Dropbox')] }),
				DOM.text('.'),
			],
		});
		const listFiles = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('list'), DOM.space(), DOM.text('List files')],
			events: {
				click: async (event) => {
					event.preventDefault();
					await this.refreshTokenIfNeeded();
					const response = await Runtime.jsonRequest({
						method: 'POST',
						url: 'https://api.dropboxapi.com/2/file_requests/list_v2',
						headers: {
							Authorization: `Bearer ${this.state?.token}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							limit: 1000,
						}),
					});
					console.log('response', response);
				},
			},
		});
		const testCreateFile = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('plus-circle'), DOM.space(), DOM.text('Create File')],
			events: {
				click: async (event) => {
					event.preventDefault();
					await this.refreshTokenIfNeeded();
					const file = await this.checkIfFileExists();
					await this.uploadLocalSave();
					if (typeof file === 'object') {
						console.log('file', file);
						// TODO
						if (file.server_modified) {
							await this.uploadLocalSave();
						}
					} else if (file === true) {
						await this.uploadLocalSave();
					} else SimpleNotification.error({ title: 'API Error ?' });
				},
			},
		});
		const sync = DOM.create('button', {
			class: 'default',
			childs: [DOM.icon('sync-alt'), DOM.space(), DOM.text('Refresh')],
			events: {
				click: async (event) => {
					event.preventDefault();
					await this.refreshTokenIfNeeded();
				},
			},
		});
		const importButton = DOM.create('button', {
			class: 'primary',
			childs: [DOM.icon('cloud-download-alt'), DOM.space(), DOM.text('Import')],
		});
		const exportButton = DOM.create('button', {
			class: 'primary',
			childs: [DOM.icon('cloud-upload-alt'), DOM.space(), DOM.text('Export')],
		});
		const deleteLogout = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('trash-alt'), DOM.space(), DOM.text('Delete and Logout')],
		});
		const logout = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('sign-out-alt'), DOM.space(), DOM.text('Logout')],
			events: {
				click: async (event) => {
					event.preventDefault();
					await this.clean();
					manager.refresh();
				},
			},
		});
		DOM.append(
			parent,
			summary,
			DOM.create('div', {
				class: 'manage',
				childs: [listFiles, testCreateFile, sync, importButton, exportButton, deleteLogout, logout],
			})
		);
	};

	/**
	 * Return a DropboxFile if it exists, true if it doesn't and false if the API returned an error.
	 */
	checkIfFileExists = async (): Promise<DropboxFile | boolean> => {
		await this.refreshTokenIfNeeded();
		const response = await Runtime.jsonRequest({
			method: 'POST',
			url: 'https://api.dropboxapi.com/2/files/search_v2',
			headers: {
				Authorization: `Bearer ${this.state?.token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ query: 'Save.json' }),
		});
		if (response.ok) {
			if (response.body?.matches && response.body.matches.length === 1) {
				return response.body.matches[0].metadata as DropboxFile;
			}
			return true;
		}
		return false;
	};

	uploadLocalSave = async (): Promise<boolean> => {
		try {
			await this.refreshTokenIfNeeded();
			const response = await Runtime.jsonRequest({
				method: 'POST',
				url: 'https://content.dropboxapi.com/2/files/upload',
				headers: {
					Authorization: `Bearer ${this.state?.token}`,
					'Dropbox-API-Arg': '{"path":"/Save.json","mode":"overwrite","mute":true}',
				},
				fileRequest: 'localSave',
			});
			return response.ok;
		} catch (error) {
			console.error(error);
			return false;
		}
	};

	refreshTokenIfNeeded = async (): Promise<boolean> => {
		if (!this.state) return false;
		if (this.state.expires < Date.now()) {
			const response = await Runtime.request<RawResponse>({
				method: 'POST',
				url: 'https://api.dropboxapi.com/oauth2/token',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: Runtime.buildQuery({
					grant_type: 'refresh_token',
					refresh_token: this.state.refresh,
					client_id: Dropbox.CLIENT_ID,
				}),
			});
			return this.handleTokenResponse(response);
		}
		return true;
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
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

	handleTokenResponse = async (response: RawResponse): Promise<boolean> => {
		try {
			const body = JSON.parse(response.body);
			if (response.ok) {
				SimpleNotification.success({ text: `Connected to **Dropbox**` });
				this.state = {
					service: 'Dropbox',
					token: body.access_token,
					expires: Date.now() + body.expires_in * 1000,
					refresh: body.refresh_token,
				};
				await LocalStorage.set('saveSync', this.state);
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

	clean = async () => {
		return LocalStorage.remove('saveSync');
	};
}

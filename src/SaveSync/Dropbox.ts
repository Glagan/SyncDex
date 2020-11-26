import { DOM } from '../Core/DOM';
import { Runtime } from '../Core/Runtime';
import { LocalStorage } from '../Core/Storage';
import { generateRandomString, pkceChallengeFromVerifier } from '../Options/PKCEHelper';
import { SaveSync } from '../Core/SaveSync';
import { log } from '../Core/Log';

interface DropboxTokenResponse {
	uid: string;
	access_token: string;
	expires_in: number;
	token_type: 'bearer';
	scope: string;
	refresh_token: string;
	account_id: string;
	error?: string;
	error_description?: string;
}

interface DropboxFile {
	'.tag': 'file';
	client_modified: string;
	content_hash: string;
	has_explicit_shared_members: boolean;
	id: string;
	is_downloadable: boolean;
	name: string;
	path_display: string;
	path_lower: string;
	rev: string;
	server_modified: string;
	sharing_info: {
		modified_by: string;
		parent_shared_folder_id: string;
		read_only: boolean;
	};
	modified_by: string;
	parent_shared_folder_id: string;
	read_only: boolean;
	size: number;
}

interface DropboxSearchResult {
	has_more: boolean;
	matches: {
		match_type: { '.tag': 'filename' };
		metadata: {
			'.tag': 'metadata';
			metadata: DropboxFile;
		};
	}[];
}

interface DropboxUploadResult {
	name: string;
	id: string;
	client_modified: string;
	server_modified: string;
	rev: string;
	size: number;
	path_lower: string;
	path_display: string;
	sharing_info: {
		read_only: boolean;
		parent_shared_folder_id: string;
		modified_by: string;
	};
	is_downloadable: boolean;
	property_groups: {
		template_id: string;
		fields: {
			name: string;
			value: string;
		}[];
	}[];
	has_explicit_shared_members: boolean;
	content_hash: string;
	file_lock_info: {
		is_lockholder: boolean;
		lockholder_name: string;
		created: string;
	};
}

// Dropbox retrieve save
// Each line is a request
// 1. list files
// 2. check if there is a save.json file
// 	3. download it with it's id if it's more recent
//	 4. update remote file with the local save if it's not more recent
//	3. create a newfile with the local save if it doesn't exists
export class Dropbox extends SaveSync {
	static icon = () => DOM.icon('b', 'dropbox');
	static CLIENT_ID = 'd8aw9vtzpdqg93y';
	static REDIRECT_URI = `${Runtime.file('options/index.html')}?for=Dropbox`;
	static FILENAME = '/Save.json';

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

	/**
	 * Return a DropboxFile if it exists, true if it doesn't and false if the API returned an error.
	 */
	fileMetadata = async (): Promise<DropboxFile | boolean | null> => {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Runtime.jsonRequest<DropboxSearchResult>({
				method: 'POST',
				url: 'https://api.dropboxapi.com/2/files/search_v2',
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ query: 'Save.json' }),
			});
			if (response.ok) {
				if (response.body?.matches && response.body.matches.length === 1) {
					return response.body.matches[0].metadata.metadata as DropboxFile;
				}
				return null;
			}
		}
		return false;
	};

	lastSync = async (): Promise<number> => {
		if (await this.refreshTokenIfNeeded()) {
			const file = await this.fileMetadata();
			if (typeof file === 'object' && file !== null) {
				return new Date(file.server_modified).getTime();
			} else if (file !== false) return 0;
		}
		return -1;
	};

	downloadExternalSave = async (): Promise<string | boolean> => {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Runtime.request({
				method: 'POST',
				url: 'https://content.dropboxapi.com/2/files/download',
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Dropbox-API-Arg': `{"path":"${Dropbox.FILENAME}"}`,
				},
			});
			if (response.ok) {
				await log(`Downloaded Dropbox Save`);
				return response.body;
			}
		}
		return false;
	};

	uploadLocalSave = async (): Promise<number> => {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Runtime.jsonRequest<DropboxUploadResult>({
				method: 'POST',
				url: 'https://content.dropboxapi.com/2/files/upload',
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Dropbox-API-Arg': `{"path":"${Dropbox.FILENAME}","mode":"overwrite","mute":true}`,
				},
				fileRequest: 'localSave',
			});
			if (response.ok) {
				await log(`Uploaded Local Save to Dropbox`);
				return new Date(response.body.server_modified).getTime();
			}
		}
		return -1;
	};

	refreshTokenIfNeeded = async (): Promise<boolean> => {
		if (!SaveSync.state) return false;
		if (SaveSync.state.expires < Date.now()) {
			await log(`Refreshing Dropbox token (expired ${SaveSync.state.expires})`);
			const response = await Runtime.request<RawResponse>({
				method: 'POST',
				url: 'https://api.dropboxapi.com/oauth2/token',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: Runtime.buildQuery({
					grant_type: 'refresh_token',
					refresh_token: SaveSync.state.refresh,
					client_id: Dropbox.CLIENT_ID,
				}),
			});
			return this.handleTokenResponse(response);
		}
		return true;
	};

	login = async (query: { [key: string]: string }): Promise<boolean> => {
		const dropboxState = await LocalStorage.get('dropboxState');
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

	delete = async (): Promise<boolean> => {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Runtime.request({
				method: 'POST',
				url: 'https://api.dropboxapi.com/2/files/delete_v2',
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ path: Dropbox.FILENAME }),
			});
			if (!response.ok) await log(`Error in Dropbox delete: [${response.body}]`);
			return response.ok;
		}
		return false;
	};

	handleTokenResponse = async (response: RawResponse): Promise<boolean> => {
		try {
			const body: DropboxTokenResponse = JSON.parse(response.body);
			if (response.ok) {
				SimpleNotification.success({ text: `Connected to **Dropbox**` });
				SaveSync.state = {
					service: 'Dropbox',
					token: body.access_token,
					expires: Date.now() + body.expires_in * 1000,
					refresh: body.refresh_token,
				};
				await LocalStorage.set('saveSync', SaveSync.state);
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
}

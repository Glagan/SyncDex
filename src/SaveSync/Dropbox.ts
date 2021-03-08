import { DOM } from '../Core/DOM';
import { Http } from '../Core/Http';
import { Storage } from '../Core/Storage';
import { generateRandomString, pkceChallengeFromVerifier } from '../Options/PKCEHelper';
import { Declare, SaveSync } from '../Core/SaveSync';
import { debug, log, LogExecTime } from '../Core/Log';

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

@Declare('Dropbox', () => DOM.icon('b', 'dropbox'))
export class Dropbox extends SaveSync {
	static CLIENT_ID = 'd8aw9vtzpdqg93y';

	createCard = (): HTMLButtonElement => {
		return DOM.create('button', {
			class: 'dropbox',
			childs: [Dropbox.icon(), DOM.space(), DOM.text('Dropbox')],
		});
	};

	onCardClick = async () => {
		const state = generateRandomString();
		const codeVerifier = generateRandomString();
		const codeChallenge = await pkceChallengeFromVerifier(codeVerifier);
		await Storage.set(StorageUniqueKey.DropboxState, { state: state, verifier: codeVerifier });
		const url = `https://www.dropbox.com/oauth2/authorize?${Http.buildQuery({
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
			const response = await Http.json<DropboxSearchResult>('https://api.dropboxapi.com/2/files/search_v2', {
				method: 'POST',
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

	@LogExecTime
	async downloadExternalSave(): Promise<string | boolean> {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Http.post('https://content.dropboxapi.com/2/files/download', {
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Dropbox-API-Arg': `{"path":"${SaveSync.FILENAME}"}`,
				},
			});
			if (response.ok && response.body) {
				await debug(`Downloaded Dropbox Save`);
				return response.body;
			}
		}
		return false;
	}

	@LogExecTime
	async uploadLocalSave(): Promise<number> {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Http.json<DropboxUploadResult>('https://content.dropboxapi.com/2/files/upload', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Dropbox-API-Arg': `{"path":"${SaveSync.FILENAME}","mode":"overwrite","mute":true}`,
				},
				file: 'localSave',
			});
			if (response.ok && response.body) {
				await debug(`Uploaded Local Save to Dropbox`);
				return new Date(response.body.server_modified).getTime();
			}
		}
		return -1;
	}

	refreshTokenIfNeeded = async (): Promise<boolean> => {
		if (!SaveSync.state) return false;
		if (SaveSync.state.expires < Date.now()) {
			await debug(`Refreshing Dropbox token (expired ${SaveSync.state.expires})`);
			const response = await Http.post('https://api.dropboxapi.com/oauth2/token', {
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: Http.buildQuery({
					grant_type: 'refresh_token',
					refresh_token: SaveSync.state.refresh,
					client_id: Dropbox.CLIENT_ID,
				}),
			});
			return (await this.handleTokenResponse(response)) == SaveSyncLoginResult.SUCCESS;
		}
		return true;
	};

	login = async (query: { [key: string]: string }): Promise<SaveSyncLoginResult> => {
		const dropboxState = await Storage.get(StorageUniqueKey.DropboxState);
		await Storage.remove(StorageUniqueKey.DropboxState);
		if (dropboxState == undefined || dropboxState.state !== query.state) {
			return SaveSyncLoginResult.STATE_ERROR;
		}
		const response = await Http.post('https://api.dropboxapi.com/oauth2/token', {
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: Http.buildQuery({
				grant_type: 'authorization_code',
				code: query.code,
				client_id: Dropbox.CLIENT_ID,
				redirect_uri: Dropbox.REDIRECT_URI,
				code_verifier: dropboxState.verifier,
			}),
		});
		return this.handleTokenResponse(response);
	};

	delete = async (): Promise<boolean> => {
		if (await this.refreshTokenIfNeeded()) {
			const response = await Http.post('https://api.dropboxapi.com/2/files/delete_v2', {
				headers: {
					Authorization: `Bearer ${SaveSync.state?.token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ path: SaveSync.FILENAME }),
			});
			if (!response.ok) await log(`Error in Dropbox delete: [${response.body}]`);
			return response.ok;
		}
		return false;
	};

	handleTokenResponse = async (response: RawResponse): Promise<SaveSyncLoginResult> => {
		try {
			if (response.ok && response.body) {
				const body: DropboxTokenResponse = JSON.parse(response.body);
				const refreshToken = SaveSync.state?.refresh ? SaveSync.state.refresh : body.refresh_token;
				SaveSync.state = {
					service: 'Dropbox',
					token: body.access_token,
					expires: Date.now() + body.expires_in * 1000,
					refresh: refreshToken,
				};
				await Storage.set(StorageUniqueKey.SaveSync, SaveSync.state);
				await debug('Obtained Dropbox token');
				return SaveSyncLoginResult.SUCCESS;
			}
			/*SimpleNotification.error({
				title: 'API Error',
				text: `The API to retrieve a token returned an error: ${body.error}\n${body.error_description}`,
			});*/
			return SaveSyncLoginResult.API_ERROR;
		} catch (error) {}
		//SimpleNotification.error({ title: 'API Error', text: 'Could not parse a body from the Dropbox API.' });
		await log('Failed to obtain Dropbox token');
		return SaveSyncLoginResult.API_ERROR;
	};
}

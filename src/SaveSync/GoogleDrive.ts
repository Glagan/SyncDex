import { DOM } from '../Core/DOM';
import { Runtime } from '../Core/Runtime';
import { Storage } from '../Core/Storage';
import { generateRandomString } from '../Options/PKCEHelper';
import { Declare, SaveSync } from '../Core/SaveSync';
import { log } from '../Core/Log';

interface GoogleDriveTokenResponse {
	access_token: string;
	expires_in: number;
	token_type: 'Bearer';
	scope: string;
	refresh_token: string;
	error?: string;
	error_description?: string;
}

interface GoogleDriveSearchResult {
	files: {
		id: string;
		modifiedTime: string;
	}[];
	error?: string;
}

interface GoogleDriveMetadata {
	id: string;
	modifiedTime: string;
	error?: string;
}

@Declare('Google Drive', () => DOM.icon('b', 'google-drive'))
export class GoogleDrive extends SaveSync {
	static CLIENT_ID = '589655435156-a6hi0egsv77ub9au4lqghia3pqnorgfr.apps.googleusercontent.com';
	static SCOPE = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file';

	createCard = (): HTMLButtonElement => {
		return DOM.create('button', {
			class: 'googleDrive',
			childs: [GoogleDrive.icon(), DOM.space(), DOM.text('Google Drive')],
		});
	};

	onCardClick = async () => {
		const state = generateRandomString();
		await Storage.set('googleDriveState', state);
		const url = `https://accounts.google.com/o/oauth2/v2/auth?${Runtime.buildQuery({
			access_type: 'offline',
			prompt: 'consent',
			response_type: 'code',
			client_id: GoogleDrive.CLIENT_ID,
			redirect_uri: GoogleDrive.REDIRECT_URI,
			scope: GoogleDrive.SCOPE,
			state: state,
		})}`;
		window.location.href = url;
	};

	lastSync = async (): Promise<number> => {
		if (await this.refreshTokenIfNeeded()) {
			if (SaveSync.state?.id) {
				// Get the file Metadata if it exists
				const response = await Runtime.jsonRequest<GoogleDriveMetadata>({
					url: `https://www.googleapis.com/drive/v3/files/${SaveSync.state.id}?fields=modifiedTime`,
					headers: { Authorization: `Bearer ${SaveSync.state.token}` },
				});
				if (response.ok && !response.body.error) {
					return new Date(response.body.modifiedTime).getTime();
				}
			} else {
				const response = await Runtime.jsonRequest<GoogleDriveSearchResult>({
					url: `https://www.googleapis.com/drive/v3/files/?pageSize=1&spaces=appDataFolder&q=name='Save.json'&fields=files(id,modifiedTime)`,
					headers: { Authorization: `Bearer ${SaveSync.state!.token}` },
				});
				if (response.ok && !response.body.error) {
					if (response.body.files.length == 1) {
						if (!SaveSync.state?.id) {
							SaveSync.state!.id = response.body.files[0].id;
							await Storage.set('saveSync', SaveSync.state);
						}
						return new Date(response.body.files[0].modifiedTime).getTime();
					}
					return 0;
				}
			}
		}
		return -1;
	};

	downloadExternalSave = async (): Promise<string | boolean> => {
		if (await this.refreshTokenIfNeeded()) {
			if (!SaveSync.state?.id) return '{}';
			const response = await Runtime.request({
				method: 'GET',
				url: `https://www.googleapis.com/drive/v3/files/${SaveSync.state!.id}?alt=media`,
				headers: { Authorization: `Bearer ${SaveSync.state!.token}` },
			});
			if (response.ok) {
				await log(`Downloaded Google Drive Save`);
				return response.body;
			}
		}
		return false;
	};

	uploadLocalSave = async (): Promise<number> => {
		if (await this.refreshTokenIfNeeded()) {
			if (SaveSync.state?.id) {
				const response = await Runtime.jsonRequest<GoogleDriveMetadata>({
					method: 'PATCH',
					url: `https://www.googleapis.com/upload/drive/v3/files/${SaveSync.state.id}?uploadType=media&fields=id,modifiedTime`,
					headers: { Authorization: `Bearer ${SaveSync.state!.token}`, 'Content-Type': 'application/json' },
					fileRequest: 'localSave',
				});
				if (response.ok && !response.body.error) {
					await log(`Uploaded Local Save to Google Drive`);
					if (SaveSync.state!.id !== response.body.id) {
						SaveSync.state!.id = response.body.id;
						await Storage.set('saveSync', SaveSync.state);
					}
					return new Date(response.body.modifiedTime).getTime();
				}
			} else {
				const response = await Runtime.jsonRequest<GoogleDriveMetadata>({
					method: 'POST',
					url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime',
					headers: { Authorization: `Bearer ${SaveSync.state!.token}` },
					fileRequest: 'namedLocalSave',
				});
				if (response.ok && !response.body.error) {
					await log(`Uploaded Local Save to Google Drive`);
					SaveSync.state!.id = response.body.id;
					await Storage.set('saveSync', SaveSync.state);
					return new Date(response.body.modifiedTime).getTime();
				}
			}
		}
		return -1;
	};

	refreshTokenIfNeeded = async (): Promise<boolean> => {
		if (!SaveSync.state) return false;
		if (SaveSync.state.expires < Date.now()) {
			await log(`Refreshing Google Drive token (expired ${SaveSync.state.expires})`);
			const response = await Runtime.request<RawResponse>({
				method: 'POST',
				url: 'https://syncdex.nikurasu.org/',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: Runtime.buildQuery({
					service: 'GoogleDrive',
					refresh_token: SaveSync.state.refresh,
				}),
			});
			return (await this.handleTokenResponse(response)) == SaveSyncLoginResult.SUCCESS;
		}
		return true;
	};

	login = async (query: { [key: string]: string }): Promise<SaveSyncLoginResult> => {
		const googleDriveState = await Storage.get('googleDriveState');
		await Storage.remove('googleDriveState');
		if (googleDriveState == undefined || googleDriveState !== query.state) {
			return SaveSyncLoginResult.STATE_ERROR;
		}
		const response = await Runtime.request({
			method: 'POST',
			url: 'https://syncdex.nikurasu.org/',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: Runtime.buildQuery({
				service: 'GoogleDrive',
				code: query.code,
				scope: GoogleDrive.SCOPE,
				redirect_uri: GoogleDrive.REDIRECT_URI,
			}),
		});
		return this.handleTokenResponse(response);
	};

	delete = async (): Promise<boolean> => {
		if (await this.refreshTokenIfNeeded()) {
			if (!SaveSync.state?.id) return false;
			const response = await Runtime.request({
				method: 'DELETE',
				url: `https://www.googleapis.com/drive/v3/files/${SaveSync.state.id}`,
				headers: { Authorization: `Bearer ${SaveSync.state?.token}` },
			});
			if (!response.ok) await log(`Error in Google Drive delete: [${response.body}]`);
			return response.ok;
		}
		return false;
	};

	handleTokenResponse = async (response: RawResponse): Promise<SaveSyncLoginResult> => {
		try {
			const body: GoogleDriveTokenResponse = JSON.parse(response.body);
			if (response.ok && !body.error) {
				// Avoid reseting refresh token
				const refreshToken = SaveSync.state?.refresh ? SaveSync.state.refresh : body.refresh_token;
				SaveSync.state = {
					id: SaveSync.state?.id,
					service: 'GoogleDrive',
					token: body.access_token,
					expires: Date.now() + body.expires_in * 1000,
					refresh: refreshToken,
				};
				await Storage.set('saveSync', SaveSync.state);
				await log('Obtained Google Drive token');
				return SaveSyncLoginResult.SUCCESS;
			}
			/*SimpleNotification.error({
				title: 'API Error',
				text: `The API to retrieve a token returned an error: ${body.error}${
					body.error_description ? `\n${body.error_description}` : ''
				}`,
			});*/
		} catch (error) {}
		//SimpleNotification.error({ title: 'API Error', text: 'Could not parse a body from the Dropbox API.' });
		await log('Failed to obtain Google Drive token');
		return SaveSyncLoginResult.API_ERROR;
	};
}

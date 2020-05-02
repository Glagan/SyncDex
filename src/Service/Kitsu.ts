import { Service, Status, ServiceName, LoginStatus, LoginMethod, ServiceKey } from './Service';
import { Options } from '../Options';
import { Runtime, JSONResponse } from '../Runtime';

export class Kitsu extends Service {
	key: ServiceKey = ServiceKey.Kitsu;
	name: ServiceName = ServiceName.Kitsu;
	status: { [key in Status]: string } = {
		[Status.NONE]: '__INVALID__',
		[Status.WONT_READ]: '__INVALID__',
		[Status.REREADING]: '__INVALID__',
		[Status.READING]: 'current',
		[Status.COMPLETED]: 'completed',
		[Status.PAUSED]: 'on_hold',
		[Status.DROPPED]: 'dropped',
		[Status.PLAN_TO_READ]: 'planned',
	};
	loginUrl = 'https://kitsu.io/api/oauth/token';
	loginMethod = LoginMethod.FORM;

	loggedIn = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuUser === undefined || !Options.tokens.kitsuToken) return LoginStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
			},
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
	};

	getUserId = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuToken === undefined) return LoginStatus.MISSING_TOKEN;
		let data = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			method: 'GET',
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/vnd.api+json',
			},
		});
		if (data.status >= 200 && data.status < 400) {
			Options.tokens.kitsuUser = data.body.data[0].id;
			return LoginStatus.SUCCESS;
		} else if (data.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		}
		return LoginStatus.BAD_REQUEST;
	};

	login = async (username: string, password: string): Promise<LoginStatus> => {
		let data = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/oauth/token',
			isJson: true,
			method: 'POST',
			headers: {
				Accept: 'application/vnd.api+json',
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(
				password
			)}`,
		});
		if (data.status == 200) {
			Options.tokens.kitsuToken = data.body.access_token;
			const userIdResp = await this.getUserId();
			await Options.save();
			if (userIdResp !== LoginStatus.SUCCESS) return userIdResp;
			return LoginStatus.SUCCESS;
		} else if (data.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		}
		return LoginStatus.BAD_REQUEST;
	};

	logout = async (): Promise<void> => {
		delete Options.tokens.kitsuToken;
		delete Options.tokens.kitsuUser;
		return await Options.save();
	};
}

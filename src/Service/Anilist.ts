import { Service, Status, ServiceName, LoginStatus, LoginMethod, ServiceKey } from './Service';
import { Options } from '../Options';
import { Runtime, JSONResponse } from '../Runtime';

export class Anilist extends Service {
	key: ServiceKey = ServiceKey.Anilist;
	name: ServiceName = ServiceName.Anilist;
	status: { [key in Status]: string } = {
		[Status.NONE]: '__INVALID__',
		[Status.WONT_READ]: '__INVALID__',
		[Status.READING]: 'CURRENT',
		[Status.COMPLETED]: 'COMPLETED',
		[Status.PAUSED]: 'PAUSED',
		[Status.DROPPED]: 'DROPPED',
		[Status.PLAN_TO_READ]: 'PLANNING',
		[Status.REREADING]: 'REPEATING',
	};
	loginUrl = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';
	loginMethod = LoginMethod.EXTERNAL;

	loggedIn = async (): Promise<LoginStatus> => {
		if (!Options.tokens.anilistToken === undefined) return LoginStatus.MISSING_TOKEN;
		const query = `query { Viewer { id } }`;
		const response = await Runtime.request<JSONResponse>({
			method: 'POST',
			url: 'https://graphql.anilist.co',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.anilistToken}`,
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
			body: JSON.stringify({ query: query }),
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
	};

	logout = async (): Promise<void> => {
		delete Options.tokens.anilistToken;
		return await Options.save();
	};
}

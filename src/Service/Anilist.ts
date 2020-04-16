import { Service, Status, ServiceName, LoginStatus } from './Service';
import { Options } from '../Options';
import { Runtime, MessageAction, JSONResponse } from '../Runtime';

export class Anilist extends Service {
	name: ServiceName = ServiceName.Anilist;
	static status: { [key in Status]: string } = {
		[Status.NONE]: '__INVALID__',
		[Status.WONT_READ]: '__INVALID__',
		[Status.READING]: 'CURRENT',
		[Status.COMPLETED]: 'COMPLETED',
		[Status.PAUSED]: 'PAUSED',
		[Status.DROPPED]: 'DROPPED',
		[Status.PLAN_TO_READ]: 'PLANNING',
		[Status.REREADING]: 'REPEATING',
	};

	loggedIn = async (): Promise<LoginStatus> => {
		if (!Options.tokens.anilistToken === undefined) return LoginStatus.NO_AUTHENTIFICATION;
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
}

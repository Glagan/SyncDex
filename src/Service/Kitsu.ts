import { Service, Status, ServiceName, LoginStatus } from './Service';
import { Options } from '../Options';
import { Runtime, MessageAction, JSONResponse } from '../Runtime';

export class Kitsu extends Service {
	name: ServiceName = ServiceName.Kitsu;
	static status: { [key in Status]: string } = {
		[Status.NONE]: '__INVALID__',
		[Status.WONT_READ]: '__INVALID__',
		[Status.REREADING]: '__INVALID__',
		[Status.READING]: 'current',
		[Status.COMPLETED]: 'completed',
		[Status.PAUSED]: 'on_hold',
		[Status.DROPPED]: 'dropped',
		[Status.PLAN_TO_READ]: 'planned',
	};

	loggedIn = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuUser === undefined || !Options.tokens.kitsuToken)
			return LoginStatus.NO_AUTHENTIFICATION;
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
}

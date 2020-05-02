import { Service, Status, ServiceName, LoginStatus, LoginMethod, ServiceKey } from './Service';
import { Runtime, RawResponse } from '../Runtime';

export class MangaUpdates extends Service {
	key: ServiceKey = ServiceKey.MangaUpdates;
	name: ServiceName = ServiceName.MangaUpdates;
	status: { [key in Status]: number } = {
		[Status.NONE]: -1,
		[Status.REREADING]: -1,
		[Status.WONT_READ]: -1,
		[Status.READING]: 0, // "read"
		[Status.PLAN_TO_READ]: 1, // "wish"
		[Status.COMPLETED]: 2, // "complete"
		[Status.DROPPED]: 3, // "unfinished"
		[Status.PAUSED]: 4, // "hold"
	};
	loginUrl: string = 'https://www.mangaupdates.com/login.html';
	loginMethod = LoginMethod.EXTERNAL;

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body &&
			response.body.indexOf(`You are currently logged in as`) >= 0
		)
			return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};
}

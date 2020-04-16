import { Service, Status, ServiceName, LoginStatus } from './Service';
import { Runtime, JSONResponse, RawResponse } from '../Runtime';

export class AnimePlanet extends Service {
	name: ServiceName = ServiceName.AnimePlanet;
	static status: { [key in Status]: number } = {
		[Status.NONE]: -1,
		[Status.REREADING]: -1,
		[Status.COMPLETED]: 1,
		[Status.READING]: 2,
		[Status.DROPPED]: 3,
		[Status.PLAN_TO_READ]: 4,
		[Status.PAUSED]: 5,
		[Status.WONT_READ]: 6,
	};

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.anime-planet.com/manga/recommendations/',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (response.body && response.body.indexOf(`"/login.php"`) < 0) return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};
}

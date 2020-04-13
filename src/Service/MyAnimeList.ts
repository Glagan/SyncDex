import { Service, Status, ServiceName, LoginStatus } from './Service';
import { Message } from '../Message';
import { MessageAction } from '../Message';

export class MyAnimeList extends Service {
	name: ServiceName = ServiceName.MyAnimeList;
	static status: { [key in Status]: number } = {
		[Status.NONE]: -1,
		[Status.WONT_READ]: -1,
		[Status.REREADING]: -1,
		[Status.READING]: 1,
		[Status.COMPLETED]: 2,
		[Status.PAUSED]: 3,
		[Status.DROPPED]: 4,
		[Status.PLAN_TO_READ]: 6,
	};

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Message.send({
			action: MessageAction.fetch,
			url: 'https://myanimelist.net/login.php',
			options: {
				method: 'GET',
				credentials: 'include',
			},
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
			response.url.indexOf('login.php') < 0
		)
			return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};
}

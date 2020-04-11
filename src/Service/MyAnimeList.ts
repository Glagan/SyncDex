import { Service, Status, ServiceName } from './Service';

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

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(true);
			}, 2000);
		});
	};
}

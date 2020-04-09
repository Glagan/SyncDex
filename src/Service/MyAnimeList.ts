import { Service, ServiceStatus, ServiceName } from './Service';

export class MyAnimeList extends Service {
	name: ServiceName = ServiceName.MyAnimeList;
	static status: { [key in ServiceStatus]: number } = {
		[ServiceStatus.NONE]: -1,
		[ServiceStatus.WONT_READ]: -1,
		[ServiceStatus.REREADING]: -1,
		[ServiceStatus.READING]: 1,
		[ServiceStatus.COMPLETED]: 2,
		[ServiceStatus.PAUSED]: 3,
		[ServiceStatus.DROPPED]: 4,
		[ServiceStatus.PLAN_TO_READ]: 6,
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(true);
			}, 2000);
		});
	};
}

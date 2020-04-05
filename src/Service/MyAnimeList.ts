import { Service, ServiceStatus } from './Service';

export class MyAnimeList extends Service {
	name: string = 'MyAnimeList';
	status: { [key in ServiceStatus]: number } = {
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
		return new Promise((resolve) => resolve(true));
	};
}

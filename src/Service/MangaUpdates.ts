import { Service, ServiceStatus } from './Service';

export class MangaUpdates extends Service {
	name: string = 'MangaUpdates';
	status: { [key in ServiceStatus]: number } = {
		[ServiceStatus.NONE]: -1,
		[ServiceStatus.REREADING]: -1,
		[ServiceStatus.WONT_READ]: -1,
		[ServiceStatus.READING]: 0, // "read"
		[ServiceStatus.PLAN_TO_READ]: 1, // "wish"
		[ServiceStatus.COMPLETED]: 2, // "complete"
		[ServiceStatus.DROPPED]: 3, // "unfinished"
		[ServiceStatus.PAUSED]: 4, // "hold"
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(false));
	};
}

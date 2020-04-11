import { Service, Status, ServiceName } from './Service';

export class MangaUpdates extends Service {
	name: ServiceName = ServiceName.MangaUpdates;
	static status: { [key in Status]: number } = {
		[Status.NONE]: -1,
		[Status.REREADING]: -1,
		[Status.WONT_READ]: -1,
		[Status.READING]: 0, // "read"
		[Status.PLAN_TO_READ]: 1, // "wish"
		[Status.COMPLETED]: 2, // "complete"
		[Status.DROPPED]: 3, // "unfinished"
		[Status.PAUSED]: 4, // "hold"
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(false));
	};
}

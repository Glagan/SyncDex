import { Service, Status, ServiceName } from './Service';

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

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(Math.random() > 0.5));
	};
}

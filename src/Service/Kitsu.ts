import { Service, Status, ServiceName } from './Service';

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

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(true));
	};
}

import { Service, ServiceStatus } from './Service';

export class Kitsu extends Service {
	name: string = 'Kitsu';
	status: { [key in ServiceStatus]: string } = {
		[ServiceStatus.NONE]: '__INVALID__',
		[ServiceStatus.WONT_READ]: '__INVALID__',
		[ServiceStatus.REREADING]: '__INVALID__',
		[ServiceStatus.READING]: 'current',
		[ServiceStatus.COMPLETED]: 'completed',
		[ServiceStatus.PAUSED]: 'on_hold',
		[ServiceStatus.DROPPED]: 'dropped',
		[ServiceStatus.PLAN_TO_READ]: 'planned',
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(true));
	};
}

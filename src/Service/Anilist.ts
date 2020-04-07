import { Service, ServiceStatus } from './Service';

export class Anilist extends Service {
	name: string = 'Anilist';
	status: { [key in ServiceStatus]: string } = {
		[ServiceStatus.NONE]: '__INVALID__',
		[ServiceStatus.WONT_READ]: '__INVALID__',
		[ServiceStatus.READING]: 'CURRENT',
		[ServiceStatus.COMPLETED]: 'COMPLETED',
		[ServiceStatus.PAUSED]: 'PAUSED',
		[ServiceStatus.DROPPED]: 'DROPPED',
		[ServiceStatus.PLAN_TO_READ]: 'PLANNING',
		[ServiceStatus.REREADING]: 'REPEATING',
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(Math.random() > 0.5));
	};
}

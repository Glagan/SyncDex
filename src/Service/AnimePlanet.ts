import { Service, Status, ServiceName } from './Service';

export class AnimePlanet extends Service {
	name: ServiceName = ServiceName.AnimePlanet;
	static status: { [key in Status]: number } = {
		[Status.NONE]: -1,
		[Status.REREADING]: -1,
		[Status.COMPLETED]: 1,
		[Status.READING]: 2,
		[Status.DROPPED]: 3,
		[Status.PLAN_TO_READ]: 4,
		[Status.PAUSED]: 5,
		[Status.WONT_READ]: 6,
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(true));
	};
}

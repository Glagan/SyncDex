import { Service, ServiceStatus, ServiceName } from './Service';

export class AnimePlanet extends Service {
	name: ServiceName = ServiceName.AnimePlanet;
	static status: { [key in ServiceStatus]: number } = {
		[ServiceStatus.NONE]: -1,
		[ServiceStatus.REREADING]: -1,
		[ServiceStatus.COMPLETED]: 1,
		[ServiceStatus.READING]: 2,
		[ServiceStatus.DROPPED]: 3,
		[ServiceStatus.PLAN_TO_READ]: 4,
		[ServiceStatus.PAUSED]: 5,
		[ServiceStatus.WONT_READ]: 6,
	};

	loggedIn = (): Promise<boolean> => {
		return new Promise((resolve) => resolve(true));
	};
}

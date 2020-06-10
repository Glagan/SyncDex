import { Service, Status, ServiceName, LoginStatus, ServiceKey } from './Service';
import { Runtime, RawResponse } from '../Runtime';

export const enum AnimePlanetStatus {
	COMPLETED = 1,
	READING = 2,
	DROPPED = 3,
	PLAN_TO_READ = 4,
	PAUSED = 5,
	WONT_READ = 6,
	NONE = -1,
}

export class AnimePlanet extends Service {
	key: ServiceKey = ServiceKey.AnimePlanet;
	name: ServiceName = ServiceName.AnimePlanet;

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.anime-planet.com/manga/recommendations/',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (response.body && response.body.indexOf(`"/login.php"`) < 0) return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};

	toStatus = (status: AnimePlanetStatus): Status => {
		switch (status) {
			case AnimePlanetStatus.COMPLETED:
				return Status.COMPLETED;
			case AnimePlanetStatus.READING:
				return Status.READING;
			case AnimePlanetStatus.DROPPED:
				return Status.DROPPED;
			case AnimePlanetStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
			case AnimePlanetStatus.PAUSED:
				return Status.PAUSED;
			case AnimePlanetStatus.WONT_READ:
				return Status.WONT_READ;
		}
		return Status.NONE;
	};

	fromStatus = (status: Status): AnimePlanetStatus => {
		switch (status) {
			case Status.COMPLETED:
				return AnimePlanetStatus.COMPLETED;
			case Status.READING:
				return AnimePlanetStatus.READING;
			case Status.DROPPED:
				return AnimePlanetStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return AnimePlanetStatus.PLAN_TO_READ;
			case Status.PAUSED:
				return AnimePlanetStatus.PAUSED;
			case Status.WONT_READ:
				return AnimePlanetStatus.WONT_READ;
		}
		return AnimePlanetStatus.NONE;
	};
}

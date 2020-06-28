import { Service, Status, ServiceName, ServiceKey } from './Service';
import { Runtime, RawResponse, RequestStatus } from '../Runtime';

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
	username: string = '';
	token: string = '';

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.anime-planet.com/contact',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return RequestStatus.BAD_REQUEST;
		}
		// Find username
		const parser = new DOMParser(); // TODO: Move as an attribute if used elsewhere
		const body = parser.parseFromString(response.body, 'text/html');
		const profileLink = body.querySelector('.loggedIn a[href^="/users/"]');
		if (profileLink !== null) {
			this.username = profileLink.getAttribute('title') ?? '';
			const token = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
			if (token !== null) this.token = token[1];
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
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

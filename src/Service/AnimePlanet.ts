import { Service, ServiceName, ServiceKey } from '../Service';
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
}

import { Service, Status, ServiceName, LoginStatus, ServiceKey } from './Service';
import { Options } from '../Options';
import { Runtime, JSONResponse } from '../Runtime';

export const enum KitsuStatus {
	READING = 'current',
	COMPLETED = 'completed',
	PAUSED = 'on_hold',
	DROPPED = 'dropped',
	PLAN_TO_READ = 'planned',
	NONE = 'none',
}

export class Kitsu extends Service<KitsuStatus> {
	key: ServiceKey = ServiceKey.Kitsu;
	name: ServiceName = ServiceName.Kitsu;

	loggedIn = async (): Promise<LoginStatus> => {
		if (Options.tokens.kitsuUser === undefined || !Options.tokens.kitsuToken) return LoginStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			url: 'https://kitsu.io/api/edge/users?filter[self]=true',
			isJson: true,
			headers: {
				Authorization: `Bearer ${Options.tokens.kitsuToken}`,
				Accept: 'application/vnd.api+json',
			},
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
	};

	toStatus = (status: KitsuStatus): Status => {
		switch (status) {
			case KitsuStatus.READING:
				return Status.READING;
			case KitsuStatus.COMPLETED:
				return Status.COMPLETED;
			case KitsuStatus.PAUSED:
				return Status.PAUSED;
			case KitsuStatus.DROPPED:
				return Status.DROPPED;
			case KitsuStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
		}
		return Status.NONE;
	};

	fromStatus = (status: Status): KitsuStatus => {
		switch (status) {
			case Status.READING:
				return KitsuStatus.READING;
			case Status.COMPLETED:
				return KitsuStatus.COMPLETED;
			case Status.PAUSED:
				return KitsuStatus.PAUSED;
			case Status.DROPPED:
				return KitsuStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return KitsuStatus.PLAN_TO_READ;
		}
		return KitsuStatus.NONE;
	};
}

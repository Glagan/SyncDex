import { Service, Status, ServiceName, LoginStatus, ServiceKey } from './Service';
import { Runtime, RawResponse } from '../Runtime';

export const enum MangaUpdatesStatus {
	READING = 0,
	PLAN_TO_READ = 1,
	COMPLETED = 2,
	DROPPED = 3,
	PAUSED = 4,
	NONE = -1,
}

export class MangaUpdates extends Service {
	key: ServiceKey = ServiceKey.MangaUpdates;
	name: ServiceName = ServiceName.MangaUpdates;

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body &&
			response.body.indexOf(`You are currently logged in as`) >= 0
		)
			return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};

	toStatus = (status: MangaUpdatesStatus): Status => {
		switch (status) {
			case MangaUpdatesStatus.READING:
				return Status.READING;
			case MangaUpdatesStatus.COMPLETED:
				return Status.COMPLETED;
			case MangaUpdatesStatus.PAUSED:
				return Status.PAUSED;
			case MangaUpdatesStatus.DROPPED:
				return Status.DROPPED;
			case MangaUpdatesStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
		}
		return Status.NONE;
	};

	fromStatus = (status: Status): MangaUpdatesStatus => {
		switch (status) {
			case Status.READING:
				return MangaUpdatesStatus.READING;
			case Status.COMPLETED:
				return MangaUpdatesStatus.COMPLETED;
			case Status.PAUSED:
				return MangaUpdatesStatus.PAUSED;
			case Status.DROPPED:
				return MangaUpdatesStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return MangaUpdatesStatus.PLAN_TO_READ;
		}
		return MangaUpdatesStatus.NONE;
	};
}

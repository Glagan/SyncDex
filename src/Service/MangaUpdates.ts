import { Service, Status, ServiceName, ServiceKey } from '../Service';
import { Runtime, RawResponse, RequestStatus } from '../Runtime';

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

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.mangaupdates.com/aboutus.html',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return RequestStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return RequestStatus.BAD_REQUEST;
		}
		if (response.ok && response.body && response.body.indexOf(`You are currently logged in as`) >= 0)
			return RequestStatus.SUCCESS;
		return RequestStatus.FAIL;
	};

	// Get a list of status to go through to be able to update to the wanted status
	static pathToStatus = (from: Status | undefined, to: Status, existing: boolean): Status[] => {
		let list: Status[] = [];
		// PAUSED requirements
		if (to == Status.PAUSED) {
			if (existing) {
				list.push(Status.READING);
			}
			if (from != Status.READING && from != Status.DROPPED) {
				list.push(Status.READING);
			}
			// DROPPED requirements
		} else if (to == Status.DROPPED) {
			if (existing) {
				list.push(Status.READING);
			}
			if (from != Status.PAUSED) {
				if (from != Status.READING) {
					list.push(Status.READING);
				}
				list.push(Status.PAUSED);
			}
			// PLAN TO READ requirements
		} else if (to == Status.PLAN_TO_READ) {
			if (!existing) {
				list.push(Status.NONE);
			}
			// COMPLETED requirements
		} else if (to == Status.COMPLETED) {
			if (!existing && from != Status.READING) {
				list.push(Status.READING);
			}
		}
		return list;
	};
}

import { Service, Status, ServiceName, LoginStatus, ServiceKey } from './Service';
import { Runtime, RawResponse } from '../Runtime';

export enum MyAnimeListStatus {
	READING = 1,
	COMPLETED = 2,
	PAUSED = 3,
	DROPPED = 4,
	PLAN_TO_READ = 6,
	NONE = -1,
}

export class MyAnimeList extends Service {
	key: ServiceKey = ServiceKey.MyAnimeList;
	name: ServiceName = ServiceName.MyAnimeList;

	loggedIn = async (): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: 'https://myanimelist.net/login.php',
			method: 'GET',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (response.ok && response.body && response.url.indexOf('login.php') < 0) {
			return LoginStatus.SUCCESS;
		}
		return LoginStatus.FAIL;
	};

	toStatus = (status: MyAnimeListStatus): Status => {
		switch (status) {
			case MyAnimeListStatus.READING:
				return Status.READING;
			case MyAnimeListStatus.COMPLETED:
				return Status.COMPLETED;
			case MyAnimeListStatus.PAUSED:
				return Status.PAUSED;
			case MyAnimeListStatus.DROPPED:
				return Status.DROPPED;
			case MyAnimeListStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
		}
		return Status.NONE;
	};

	fromStatus = (status: Status): MyAnimeListStatus => {
		switch (status) {
			case Status.READING:
				return MyAnimeListStatus.READING;
			case Status.COMPLETED:
				return MyAnimeListStatus.COMPLETED;
			case Status.PAUSED:
				return MyAnimeListStatus.PAUSED;
			case Status.DROPPED:
				return MyAnimeListStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return MyAnimeListStatus.PLAN_TO_READ;
		}
		return MyAnimeListStatus.NONE;
	};
}

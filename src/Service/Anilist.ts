import { Service, Status, ServiceName, LoginStatus, ServiceKey } from './Service';
import { Options } from '../Options';
import { Runtime, JSONResponse } from '../Runtime';

interface AnilistHeaders {
	Authorization: string;
	'Content-Type': string;
	Accept: string;
	[key: string]: string;
}

export const enum AnilistStatus {
	READING = 'CURRENT',
	COMPLETED = 'COMPLETED',
	PAUSED = 'PAUSED',
	DROPPED = 'DROPPED',
	PLAN_TO_READ = 'PLANNING',
	REREADING = 'REPEATING',
	NONE = 'NONE',
}

export class Anilist extends Service<AnilistStatus> {
	key: ServiceKey = ServiceKey.Anilist;
	name: ServiceName = ServiceName.Anilist;
	static APIUrl: string = 'https://anilist.co/api/v2/oauth/authorize?client_id=3374&response_type=token';
	static LoginQuery: string = `query { Viewer { id } }`;
	static LoggedHeaders = (): AnilistHeaders => {
		return {
			Authorization: `Bearer ${Options.tokens.anilistToken}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
		};
	};

	loggedIn = async (): Promise<LoginStatus> => {
		if (!Options.tokens.anilistToken === undefined) return LoginStatus.MISSING_TOKEN;
		const response = await Runtime.request<JSONResponse>({
			method: 'POST',
			url: Anilist.APIUrl,
			isJson: true,
			headers: Anilist.LoggedHeaders(),
			body: JSON.stringify({ query: Anilist.LoginQuery }),
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		return LoginStatus.SUCCESS;
	};

	toStatus = (status: AnilistStatus): Status => {
		switch (status) {
			case AnilistStatus.READING:
				return Status.READING;
			case AnilistStatus.COMPLETED:
				return Status.COMPLETED;
			case AnilistStatus.PAUSED:
				return Status.PAUSED;
			case AnilistStatus.DROPPED:
				return Status.DROPPED;
			case AnilistStatus.PLAN_TO_READ:
				return Status.PLAN_TO_READ;
			case AnilistStatus.REREADING:
				return Status.REREADING;
		}
		return Status.NONE;
	};

	fromStatus = (status: Status): AnilistStatus => {
		switch (status) {
			case Status.READING:
				return AnilistStatus.READING;
			case Status.COMPLETED:
				return AnilistStatus.COMPLETED;
			case Status.PLAN_TO_READ:
				return AnilistStatus.PLAN_TO_READ;
			case Status.DROPPED:
				return AnilistStatus.DROPPED;
			case Status.PAUSED:
				return AnilistStatus.PAUSED;
			case Status.REREADING:
				return AnilistStatus.REREADING;
		}
		return AnilistStatus.NONE;
	};
}

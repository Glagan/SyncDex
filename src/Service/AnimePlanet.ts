import { Runtime, RequestStatus } from '../Runtime';
import { ServiceTitle, Title, ServiceKey, ServiceName } from '../Title';

export const enum AnimePlanetStatus {
	NONE = 0,
	COMPLETED = 1,
	READING = 2,
	DROPPED = 3,
	PLAN_TO_READ = 4,
	PAUSED = 5,
	WONT_READ = 6,
}

interface AnimePlanetAPIResponse {
	id: number;
	type: 'manga';
	success: boolean;
	[key: string]: any;
}

export class AnimePlanetTitle extends ServiceTitle<AnimePlanetTitle> {
	readonly serviceKey: ServiceKey = ServiceKey.AnimePlanet;
	readonly serviceName: ServiceName = ServiceName.AnimePlanet;

	status: AnimePlanetStatus;
	token: string;

	constructor(id: number | string, title?: Partial<AnimePlanetTitle>) {
		super(id, title);
		this.status = title && title.status !== undefined ? title.status : AnimePlanetStatus.NONE;
		this.token = title && title.token !== undefined ? title.token : '';
	}

	static get = async <T extends ServiceTitle<T> = AnimePlanetTitle>(
		id: number | string
	): Promise<AnimePlanetTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/manga/${id}`,
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.redirected) return RequestStatus.NOT_FOUND;
		const values: Partial<AnimePlanetTitle> = {};
		const tokenArr = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		if (tokenArr !== null) {
			values.token = tokenArr[1];
			const mediaEntryForm = body.querySelector('form[id^=manga]');
			if (mediaEntryForm) {
				const statusSelector = mediaEntryForm.querySelector<HTMLOptionElement>(
					'select.changeStatus [selected]'
				);
				if (statusSelector) values.status = parseInt(statusSelector.value);
				// Chapter
				const chapterSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.chapters [selected]');
				values.progress = { chapter: 0 };
				if (chapterSelector) values.progress.chapter = parseInt(chapterSelector.value);
				// Volume
				const volumeSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.volumes [selected]');
				if (volumeSelector) values.progress.volume = parseInt(volumeSelector.value);
				// Score
				const score = mediaEntryForm.querySelector<HTMLElement>('div.starrating > div[name]');
				if (score) values.score = parseFloat(score.getAttribute('name') as string) * 20;
			}
		}
		values.name = (body.querySelector(`h1[itemprop='name']`) as HTMLElement).textContent as string;
		return new AnimePlanetTitle(id, values);
	};

	persist = async (): Promise<RequestStatus> => {
		let response = await Runtime.jsonRequest({
			url: `https://www.anime-planet.com/api/list/status/manga/${this.id}/${this.status}/${this.token}`,
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		// Chapter progress
		if (this.progress.chapter > 0) {
			response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/update/manga/${this.id}/${this.progress.chapter}/0/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
		}
		// Score
		if (this.score !== undefined && this.score > 0) {
			// Convert 0-100 score to the 0-5 range -- Round to nearest .5
			const apScore = Math.round((this.score / 20) * 2) / 2;
			response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/rate/manga/${this.id}/${apScore}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		if (this.token == '') return RequestStatus.BAD_REQUEST;
		const response = await Runtime.jsonRequest({
			url: `https://www.anime-planet.com/api/list/status/manga/${this.id}/0/${this.token}`,
			method: 'GET',
			credentials: 'include',
		});
		return Runtime.responseStatus(response);
	};

	static toStatus = (status: AnimePlanetStatus): Status => {
		switch (status) {
			case AnimePlanetStatus.NONE:
				return Status.NONE;
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
	};

	toTitle = (): Title | undefined => {
		if (!this.mangaDex) return undefined;
		return new Title(this.mangaDex, {
			services: { ap: this.id as number },
			progress: this.progress,
			status: AnimePlanetTitle.toStatus(this.status),
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			name: this.name,
		});
	};

	static fromStatus = (status: Status): AnimePlanetStatus => {
		switch (status) {
			case Status.READING:
				return AnimePlanetStatus.READING;
			case Status.COMPLETED:
				return AnimePlanetStatus.COMPLETED;
			case Status.PAUSED:
				return AnimePlanetStatus.PAUSED;
			case Status.DROPPED:
				return AnimePlanetStatus.DROPPED;
			case Status.PLAN_TO_READ:
				return AnimePlanetStatus.PLAN_TO_READ;
			case Status.WONT_READ:
				return AnimePlanetStatus.WONT_READ;
		}
		return AnimePlanetStatus.NONE;
	};

	static fromTitle = <T extends ServiceTitle<T> = AnimePlanetTitle>(title: Title): AnimePlanetTitle | undefined => {
		if (!title.services.ap) return undefined;
		return new AnimePlanetTitle(title.services.ap, {
			progress: title.progress,
			status: AnimePlanetTitle.fromStatus(title.status),
			score: title.score ? title.score : undefined,
			name: title.name,
		});
	};
}

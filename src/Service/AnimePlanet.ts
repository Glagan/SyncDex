import { Runtime, RequestStatus } from '../Runtime';
import { ServiceKeyType, ActivableName, ActivableKey, ExternalTitle, MissableField } from '../Title';

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

export class AnimePlanetTitle extends ExternalTitle {
	static readonly serviceName: ActivableName = ActivableName.AnimePlanet;
	static readonly serviceKey: ActivableKey = ActivableKey.AnimePlanet;
	static readonly missingFields: MissableField[] = ['volume', 'start', 'end'];

	static link(id: ServiceKeyType): string {
		if (typeof id === 'string') return `https://www.anime-planet.com/manga/${id}`;
		else if (typeof id === 'number') return '#';
		return `https://www.anime-planet.com/manga/${id.s}`;
	}

	id: AnimePlanetReference;
	token: string;

	constructor(id: ServiceKeyType, title?: Partial<AnimePlanetTitle>) {
		super(title);
		if (typeof id !== 'object') throw 'AnimePlanet ID can only be a reference';
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : Status.NONE;
		this.token = title && title.token !== undefined ? title.token : '';
	}

	static get = async (id: ServiceKeyType): Promise<ExternalTitle | RequestStatus> => {
		const slug = typeof id === 'string' ? id : (id as AnimePlanetReference).s;
		const response = await Runtime.request<RawResponse>({
			url: AnimePlanetTitle.link(id),
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.redirected) return RequestStatus.NOT_FOUND;
		const values: Partial<AnimePlanetTitle> = { status: Status.NONE };
		const tokenArr = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		if (tokenArr !== null) {
			values.loggedIn = true;
			values.token = tokenArr[1];
		} else values.loggedIn = false;
		// No need to be logged in to have api ID
		const mediaEntryForm = body.querySelector<HTMLFormElement>('form[id^=manga]')!;
		const api = parseInt(mediaEntryForm.dataset.id!);
		const statusSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.changeStatus [selected]');
		if (statusSelector) values.status = AnimePlanetTitle.toStatus(parseInt(statusSelector.value));
		values.inList = values.status != Status.NONE;
		// Chapter
		const chapterSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.chapters [selected]');
		values.progress = { chapter: 0 };
		if (chapterSelector) values.progress.chapter = parseInt(chapterSelector.value);
		// Volume
		const volumeSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.volumes [selected]');
		if (volumeSelector) values.progress.volume = parseInt(volumeSelector.value);
		// Score
		const score = mediaEntryForm.querySelector<HTMLElement>('div.starrating > div[name]');
		if (score) values.score = parseFloat(score.getAttribute('name')!) * 20;
		values.name = body.querySelector(`h1[itemprop='name']`)!.textContent!;
		return new AnimePlanetTitle(
			{
				s: slug,
				i: api,
			},
			values
		);
	};

	persist = async (): Promise<RequestStatus> => {
		const id = this.id.i;
		let response = await Runtime.jsonRequest({
			url: `https://www.anime-planet.com/api/list/status/manga/${id}/${AnimePlanetTitle.fromStatus(
				this.status
			)}/${this.token}`,
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		// Chapter progress
		if (this.progress.chapter > 0) {
			response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/update/manga/${id}/${this.progress.chapter}/0/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
		}
		// Score
		if (this.score !== undefined && this.score > 0) {
			// Convert 0-100 score to the 0-5 range -- Round to nearest .5
			const apScore = Math.round((this.score / 20) * 2) / 2;
			response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/rate/manga/${id}/${apScore}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
		}
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		if (this.token == '') return RequestStatus.BAD_REQUEST;
		const id = this.id.i;
		const response = await Runtime.jsonRequest({
			url: `https://www.anime-planet.com/api/list/status/manga/${id}/0/${this.token}`,
			method: 'GET',
			credentials: 'include',
		});
		this.inList = false;
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

	static idFromLink = (href: string): AnimePlanetReference => {
		const regexp = /https:\/\/(?:www\.)?anime-planet\.com\/manga\/(.+)\/?/.exec(href);
		if (regexp !== null)
			return {
				s: regexp[1],
				i: 0,
			};
		return { s: '', i: 0 };
	};

	get mochi(): number {
		return this.id.i;
	}
}

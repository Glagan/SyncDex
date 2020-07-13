import { Runtime, RequestStatus } from '../Runtime';
import { ServiceTitle, Title, ServiceName, ServiceKey, ServiceKeyType } from '../Title';

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
	readonly serviceName: ServiceName = ServiceName.AnimePlanet;
	readonly serviceKey: ServiceKey = ServiceKey.AnimePlanet;

	static link(id: ServiceKeyType): string {
		if (typeof id === 'string') return `https://www.anime-planet.com/manga/${id}`;
		else if (typeof id === 'number') return '#';
		return `https://www.anime-planet.com/manga/${id.s}`;
	}

	id: AnimePlanetReference;
	status: AnimePlanetStatus;
	token: string;

	constructor(id: AnimePlanetReference, title?: Partial<AnimePlanetTitle>) {
		super(title);
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : AnimePlanetStatus.NONE;
		this.token = title && title.token !== undefined ? title.token : '';
	}

	static get = async (id: string | AnimePlanetReference): Promise<AnimePlanetTitle | RequestStatus> => {
		const slug = typeof id === 'string' ? id : id.s;
		const response = await Runtime.request<RawResponse>({
			url: AnimePlanetTitle.link(id),
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.redirected) return RequestStatus.NOT_FOUND;
		const values: Partial<AnimePlanetTitle> = {};
		const tokenArr = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		if (tokenArr !== null) values.token = tokenArr[1];
		// No need to be logged in to have api ID
		const mediaEntryForm = body.querySelector<HTMLFormElement>('form[id^=manga]')!;
		const api = parseInt(mediaEntryForm.dataset.id!);
		const statusSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.changeStatus [selected]');
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
			url: `https://www.anime-planet.com/api/list/status/manga/${id}/${this.status}/${this.token}`,
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
			services: { ap: this.id },
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

	static fromTitle = (title: Title): AnimePlanetTitle | undefined => {
		if (!title.services.ap) return undefined;
		return new AnimePlanetTitle(title.services.ap, {
			progress: title.progress,
			status: AnimePlanetTitle.fromStatus(title.status),
			score: title.score ? title.score : undefined,
			name: title.name,
		});
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

import { Runtime } from '../Core/Runtime';
import { ActivableKey, ActivableName, LoginMethod, Service, Services } from '../Core/Service';
import { ModuleInterface } from '../Core/ModuleInterface';
import { ImportModule, ModuleOptions } from '../Core/Module';
import { ExternalTitle, ExternalTitles, FoundTitle, MissableField } from '../Core/Title';

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

export class AnimePlanetImport extends ImportModule {
	constructor(moduleInterface?: ModuleInterface) {
		super(AnimePlanet, moduleInterface);
	}

	execute = async (options: ModuleOptions): Promise<boolean | FoundTitle[]> => {
		return false;
	};
}

export class AnimePlanet extends Service {
	static readonly serviceName = ActivableName.AnimePlanet;
	static readonly serviceKey = ActivableKey.AnimePlanet;

	static readonly usesSlug = true;
	static readonly missingFields: MissableField[] = ['volume', 'start', 'end'];

	static loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	static loginUrl: string = 'https://www.anime-planet.com/login';

	static username: string = '';
	static token: string = '';

	static async loggedIn(): Promise<RequestStatus> {
		const response = await Runtime.request<RawResponse>({
			url: 'https://www.anime-planet.com/contact',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		// Find username
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const profileLink = body.querySelector('.loggedIn a[href^="/users/"]');
		if (profileLink !== null) {
			this.username = profileLink.getAttribute('title') ?? '';
			const token = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
			if (token !== null) this.token = token[1];
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
	}

	static importModule = (moduleInterface?: ModuleInterface) => new AnimePlanetImport(moduleInterface);

	static link(key: MediaKey) {
		return `https://www.anime-planet.com/manga/${key.slug}`;
	}
}

Services[ActivableKey.AnimePlanet] = AnimePlanet;

export class AnimePlanetTitle extends ExternalTitle {
	static readonly serviceName = ActivableName.AnimePlanet;
	static readonly serviceKey = ActivableKey.AnimePlanet;
	static readonly requireIdQuery: boolean = true;

	token: string = '';
	current: {
		progress: Progress;
		status: Status;
		score?: number;
	} = { progress: { chapter: 0 }, status: Status.NONE };

	static get = async (key: MediaKey): Promise<ExternalTitle | RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: AnimePlanetTitle.link(key),
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		if (response.redirected) return RequestStatus.NOT_FOUND;
		const values: Partial<AnimePlanetTitle> = { status: Status.NONE, key: key };
		values.current = { progress: { chapter: 0 }, status: Status.NONE };
		const tokenArr = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		if (tokenArr !== null) {
			values.loggedIn = true;
			values.token = tokenArr[1];
		} else values.loggedIn = false;
		// Maximum chapter and volume -- only if the title is finished, or else it would return invalid max chapter
		if (document.querySelector('select.changeStatus > option[value="1"]')) {
			const chapterSelect = body.querySelector<HTMLElement>("select[name='chapters']");
			const volumeSelect = body.querySelector<HTMLElement>("select[name='volumes']");
			values.max = {
				chapter: parseInt(chapterSelect?.dataset?.eps ?? '') || undefined,
				volume: parseInt(volumeSelect?.dataset?.eps ?? '') || undefined,
			};
			console.debug(values.max);
		}
		// No need to be logged in to have api ID
		const mediaEntryForm = body.querySelector<HTMLFormElement>('form[id^=manga]')!;
		values.key!.id = parseInt(mediaEntryForm.dataset.id!);
		const statusSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.changeStatus [selected]');
		if (statusSelector) {
			values.status = AnimePlanetTitle.toStatus(parseInt(statusSelector.value));
			values.current.status = values.status;
		}
		values.inList = values.status != Status.NONE;
		// Chapter
		const chapterSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.chapters [selected]');
		values.progress = { chapter: 0 };
		if (chapterSelector) {
			values.progress.chapter = parseInt(chapterSelector.value);
			values.progress.chapter = values.progress.chapter;
		}
		// Volume
		const volumeSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.volumes [selected]');
		if (volumeSelector) {
			values.progress.volume = parseInt(volumeSelector.value);
			values.progress.volume = values.progress.volume;
		}
		// Score
		const score = mediaEntryForm.querySelector<HTMLElement>('div.starrating > div[name]');
		if (score) {
			values.score = parseFloat(score.getAttribute('name')!) * 20;
			values.score = values.score;
		}
		values.name = body.querySelector(`h1[itemprop='name']`)!.textContent!;
		return new AnimePlanetTitle(values);
	};

	persist = async (): Promise<RequestStatus> => {
		if (this.status === Status.NONE) return RequestStatus.BAD_REQUEST;
		const id = this.key;
		// Only update Status if it's different
		if (this.current.status !== this.status) {
			const response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/status/manga/${id}/${AnimePlanetTitle.fromStatus(
					this.status
				)}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.status = this.status;
		}
		// Chapter progress
		if (this.progress.chapter > 0 && this.current.progress.chapter !== this.progress.chapter) {
			const response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/update/manga/${id}/${Math.floor(this.progress.chapter)}/0/${
					this.token
				}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.progress.chapter = this.progress.chapter;
		}
		// Score
		if (this.score > 0 && this.current.score !== this.score) {
			// Convert 0-100 score to the 0-5 range -- Round to nearest .5
			const apScore = Math.round((this.score / 20) * 2) / 2;
			const response = await Runtime.jsonRequest({
				url: `https://www.anime-planet.com/api/list/rate/manga/${id}/${apScore}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.score = this.score;
		}
		if (!this.inList) {
			this.inList = true;
			return RequestStatus.CREATED;
		}
		return RequestStatus.SUCCESS;
	};

	delete = async (): Promise<RequestStatus> => {
		if (this.token == '') return RequestStatus.BAD_REQUEST;
		const id = this.key;
		const response = await Runtime.jsonRequest({
			url: `https://www.anime-planet.com/api/list/status/manga/${id}/0/${this.token}`,
			method: 'GET',
			credentials: 'include',
		});
		this.inList = false;
		const status = Runtime.responseStatus(response);
		return status == RequestStatus.SUCCESS ? RequestStatus.DELETED : status;
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

	static idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?anime-planet\.com\/manga\/(.+)\/?/.exec(href);
		if (regexp !== null) return { slug: regexp[1] };
		return { slug: '', id: 0 };
	};

	static idFromString = (str: string): MediaKey => {
		return { slug: str };
	};

	get mochi(): number {
		return this.key.id!;
	}
}

ExternalTitles[ActivableKey.AnimePlanet] = AnimePlanetTitle;

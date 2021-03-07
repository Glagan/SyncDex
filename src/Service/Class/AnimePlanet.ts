import { Request } from '../../Core/Request';
import { Service, LoginMethod } from '../../Core/Service';
import { Title, MissableField } from '../../Core/Title';
import { debug, log, LogExecTime } from '../../Core/Log';
import { ActivableKey } from '../Keys';
import { ServiceName } from '../Names';

export const enum AnimePlanetStatus {
	NONE = 0,
	COMPLETED = 1,
	READING = 2,
	DROPPED = 3,
	PLAN_TO_READ = 4,
	PAUSED = 5,
	WONT_READ = 6,
}

/*interface AnimePlanetAPIResponse {
	id: number;
	type: 'manga';
	success: boolean;
	[key: string]: any;
}*/

export class AnimePlanet extends Service {
	name = ServiceName.AnimePlanet;
	key = ActivableKey.AnimePlanet;
	activable = true;

	loginMethod = LoginMethod.EXTERNAL;
	loginUrl = 'https://www.anime-planet.com/login';

	updateKeyOnFirstFetch = true;
	usesSlug = true;

	static username: string = '';
	static token: string = '';

	async loggedIn(): Promise<ResponseStatus> {
		const response = await Request.get<RawResponse>({
			url: 'https://www.anime-planet.com/contact',
			credentials: 'include',
		});
		if (!response.ok) return Request.status(response);
		// Find username
		const parser = new DOMParser();
		const body = parser.parseFromString(response.body, 'text/html');
		const profileLink = body.querySelector('.loggedIn a[href^="/users/"]');
		if (profileLink !== null) {
			AnimePlanet.username = profileLink.getAttribute('title') ?? '';
			const token = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
			if (token !== null) AnimePlanet.token = token[1];
			return ResponseStatus.SUCCESS;
		}
		return ResponseStatus.FAIL;
	}

	@LogExecTime
	async get(key: MediaKey): Promise<Title | ResponseStatus> {
		const response = await Request.get<RawResponse>({
			url: this.link(key),
			method: 'GET',
			credentials: 'include',
		});
		if (!response.ok) return Request.status(response);
		if (response.redirected) return ResponseStatus.NOT_FOUND;
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
		}
		// No need to be logged in to have API ID
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
		}
		// Volume
		const volumeSelector = mediaEntryForm.querySelector<HTMLOptionElement>('select.volumes [selected]');
		if (volumeSelector) {
			values.progress.volume = parseInt(volumeSelector.value);
		}
		// Score
		const score = mediaEntryForm.querySelector<HTMLElement>('div.starrating > div[name]');
		if (score) {
			values.score = parseFloat(score.getAttribute('name')!) * 20;
			values.score = values.score;
		}
		values.name = body.querySelector(`h1[itemprop='name']`)!.textContent!;
		return new AnimePlanetTitle(values);
	}

	link(key: MediaKey) {
		return `https://www.anime-planet.com/manga/${key.slug}`;
	}

	idFromLink = (href: string): MediaKey => {
		const regexp = /https:\/\/(?:www\.)?anime-planet\.com\/manga\/(.+)\/?/.exec(href);
		if (regexp !== null) return { slug: regexp[1] };
		return { slug: '', id: 0 };
	};

	idFromString = (str: string): MediaKey => {
		return { slug: str };
	};

	static compareId(id1: MediaKey, id2: MediaKey): boolean {
		return (id1.id == id2.id || !id1.id || !id2.id) && id1.slug == id2.slug;
	}
}

export const AnimePlanetAPI = 'https://www.anime-planet.com/api/list';
export class AnimePlanetTitle extends Title {
	static missingFields: MissableField[] = ['volume', 'start', 'end'];

	token?: string;
	current: {
		progress: Progress;
		status: Status;
		score?: number;
	} = { progress: { chapter: 0 }, status: Status.NONE };

	@LogExecTime
	async persist(): Promise<ResponseStatus> {
		if (this.status === Status.NONE || !this.token) {
			await log(`Could not sync AnimePlanet: status ${this.status} token ${!!this.token}`);
			return ResponseStatus.BAD_REQUEST;
		}
		const id = this.key.id;
		// Only update Status if it's different
		if (this.current.status !== this.status) {
			const response = await Request.json({
				url: `${AnimePlanetAPI}/status/manga/${id}/${AnimePlanetTitle.fromStatus(this.status)}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Request.status(response);
			this.current.status = this.status;
		}
		// Chapter progress
		const chapterToUpdate = this.max?.chapter && this.max.chapter < this.chapter ? this.max.chapter : this.chapter;
		if (this.chapter > 0 && this.current.progress.chapter !== chapterToUpdate) {
			const response = await Request.json({
				url: `${AnimePlanetAPI}/update/manga/${id}/${Math.floor(chapterToUpdate)}/0/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Request.status(response);
			this.current.progress.chapter = this.chapter;
		}
		// Score
		if (this.score > 0 && this.current.score !== this.score) {
			// Convert 0-100 score to the 0-5 range -- Round to nearest .5
			const apScore = Math.round((this.score / 20) * 2) / 2;
			const response = await Request.json({
				url: `${AnimePlanetAPI}/rate/manga/${id}/${apScore}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Request.status(response);
			this.current.score = this.score;
		}
		if (!this.inList) {
			this.inList = true;
			return ResponseStatus.CREATED;
		}
		return ResponseStatus.SUCCESS;
	}

	delete = async (): Promise<ResponseStatus> => {
		if (!this.inList || !this.token) {
			await log(`Could not sync AnimePlanet: status ${this.status} token ${!!this.token}`);
			return ResponseStatus.BAD_REQUEST;
		}
		const id = this.key.id;
		const response = await Request.json({
			url: `${AnimePlanetAPI}/status/manga/${id}/0/${this.token}`,
			method: 'GET',
			credentials: 'include',
		});
		this.reset();
		const status = Request.status(response);
		return status == ResponseStatus.SUCCESS ? ResponseStatus.DELETED : status;
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
}

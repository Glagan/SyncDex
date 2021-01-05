import { Runtime } from '../Core/Runtime';
import { LoginMethod, Service } from '../Core/Service';
import { duration, ExportModule, ImportModule } from '../Core/Module';
import { ExternalTitle, LocalTitle, MissableField } from '../Core/Title';
import { DOM } from '../Core/DOM';
import { log } from '../Core/Log';
import { ActivableKey } from './Keys';
import { ServiceName } from './Names';

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
	preExecute = async (): Promise<boolean> => {
		if (AnimePlanet.username == '') {
			this.interface?.message('error', 'Username not found while checking if logged in.');
			return false;
		}
		const message = this.interface?.message('loading', 'Setting list type...');
		const response = await Runtime.request<RawResponse>({
			url: `https://www.anime-planet.com/users/${AnimePlanet.username}/manga/reading?sort=title&mylist_view=list`,
			credentials: 'include',
		});
		message?.classList.remove('loading');
		return response.ok;
	};

	execute = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Fetching all titles...' });
		const message = this.interface?.message('loading', [progress]);
		const parser = new DOMParser();

		// Get each pages
		let lastPage = false;
		let current = 1;
		let max = 1;
		while (!this.interface?.doStop && !lastPage) {
			progress.textContent = `Fetching all titles... Page ${current} out of ${max}.`;
			const response = await Runtime.request<RawResponse>({
				url: `https://www.anime-planet.com/users/${AnimePlanet.username}/manga?sort=title&page=${current}`,
				credentials: 'include',
			});
			if (!response.ok || typeof response.body !== 'string') {
				message?.classList.remove('loading');
				this.interface?.message(
					'warning',
					'The request failed, maybe AnimePlanet is having problems, retry later.'
				);
				return false;
			}

			// Find all Titles
			const body = parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll('table.personalList tbody tr');
			for (const row of rows) {
				const name = row.querySelector('a.tooltip') as HTMLAnchorElement;
				const slug = /\/manga\/(.+)/.exec(name.href);
				if (slug) {
					const form = row.querySelector('form[data-id]') as HTMLSelectElement;
					const chapterSelector = row.querySelector('select[name="chapters"]') as HTMLSelectElement;
					const volumeSelector = row.querySelector('select[name="volumes"]') as HTMLSelectElement;
					const statusSelector = row.querySelector('select.changeStatus') as HTMLSelectElement;
					// Score range: 0-5 with increments of 0.5
					const score = row.querySelector('div.starrating > div[name]') as HTMLElement;
					const status = AnimePlanetTitle.toStatus(parseInt(statusSelector.value));
					let max: Partial<Progress> | undefined = undefined;
					if (status == Status.COMPLETED) {
						max = {
							volume:
								parseInt(
									(volumeSelector[volumeSelector.length - 1] as HTMLOptionElement).value as string
								) ?? undefined,
							chapter:
								parseInt(
									(chapterSelector[chapterSelector.length - 1] as HTMLOptionElement).value as string
								) ?? undefined,
						};
					}
					this.found.push({
						key: {
							id: parseInt(form.dataset.id as string),
							slug: slug[1],
						},
						progress: {
							chapter: parseInt(chapterSelector.value as string),
							volume: parseInt(volumeSelector.value as string),
						},
						max: max,
						status: status,
						score: parseFloat(score.getAttribute('name') as string) * 20,
						name: name.textContent as string,
						mochi: parseInt(form.dataset.id as string),
					});
				}
			}

			// Check last page
			const navigation = body.querySelector('div.pagination > ul.nav');
			if (navigation !== null) {
				const last = navigation.lastElementChild?.previousElementSibling;
				if (last !== null && last !== undefined) {
					max = parseInt(last.textContent as string);
				}
			}
			lastPage = current >= max;
			current++;
		}
		message?.classList.remove('loading');

		return this.interface ? !this.interface.doStop : true;
	};
}

export class AnimePlanetExport extends ExportModule {
	preExecute = async (_filter: LocalTitle[]): Promise<boolean> => {
		if (AnimePlanet.username == '') {
			this.interface?.message('error', 'Username not found while checking if logged in.');
			return false;
		}
		if (AnimePlanet.token == '') {
			this.interface?.message('error', 'Token not found.');
			return false;
		}
		return true;
	};

	execute = async (titles: LocalTitle[]): Promise<boolean> => {
		const max = titles.length;
		this.interface?.message('default', `Exporting ${max} Titles...`);
		const progress = DOM.create('p');
		const message = this.interface?.message('loading', [progress]);
		let average = 0;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const localTitle = titles[current];
			let currentProgress = `Exporting Title ${current + 1} out of ${max} (${
				localTitle.name || `#${localTitle.services[ActivableKey.AnimePlanet]!.id}`
			})...`;
			if (average > 0) currentProgress += `\nEstimated time remaining: ${duration((max - current) * average)}.`;
			progress.textContent = currentProgress;
			const before = Date.now();
			const title = new AnimePlanetTitle({
				...localTitle,
				key: localTitle.services[ActivableKey.AnimePlanet],
			});
			title.token = AnimePlanet.token;
			const response = await title.persist();
			if (average == 0) average = Date.now() - before;
			else average = (average + (Date.now() - before)) / 2;
			if (response <= RequestStatus.CREATED) this.summary.valid++;
			else this.summary.failed.push(localTitle);
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
	};
}

export class AnimePlanet extends Service {
	name = ServiceName.AnimePlanet;
	key = ActivableKey.AnimePlanet;
	activable = true;

	loginMethod = LoginMethod.EXTERNAL;
	loginUrl = 'https://www.anime-planet.com/login';

	updateKeyOnFirstFetch = true;
	usesSlug = true;
	missingFields: MissableField[] = ['volume', 'start', 'end'];

	importModule = AnimePlanetImport;
	exportModule = AnimePlanetExport;

	static username: string = '';
	static token: string = '';

	async loggedIn(): Promise<RequestStatus> {
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
			AnimePlanet.username = profileLink.getAttribute('title') ?? '';
			const token = /TOKEN\s*=\s*'(.{40})';/.exec(response.body);
			if (token !== null) AnimePlanet.token = token[1];
			return RequestStatus.SUCCESS;
		}
		return RequestStatus.FAIL;
	}

	async get(key: MediaKey): Promise<ExternalTitle | RequestStatus> {
		const response = await Runtime.request<RawResponse>({
			url: this.link(key),
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
}

export const AnimePlanetAPI = 'https://www.anime-planet.com/api/list';
export class AnimePlanetTitle extends ExternalTitle {
	static service = new AnimePlanet();
	static readonly requireIdQuery: boolean = true;

	token?: string;
	current: {
		progress: Progress;
		status: Status;
		score?: number;
	} = { progress: { chapter: 0 }, status: Status.NONE };

	persist = async (): Promise<RequestStatus> => {
		if (this.status === Status.NONE || !this.token) {
			await log(`Could not sync AnimePlanet: status ${this.status} token ${!!this.token}`);
			return RequestStatus.BAD_REQUEST;
		}
		const id = this.key.id;
		// Only update Status if it's different
		if (this.current.status !== this.status) {
			const response = await Runtime.jsonRequest({
				url: `${AnimePlanetAPI}/status/manga/${id}/${AnimePlanetTitle.fromStatus(this.status)}/${this.token}`,
				credentials: 'include',
			});
			if (!response.ok) return Runtime.responseStatus(response);
			this.current.status = this.status;
		}
		// Chapter progress
		const chapterToUpdate =
			this.max?.chapter && this.max.chapter < this.progress.chapter ? this.max.chapter : this.progress.chapter;
		if (this.progress.chapter > 0 && this.current.progress.chapter !== chapterToUpdate) {
			const response = await Runtime.jsonRequest({
				url: `${AnimePlanetAPI}/update/manga/${id}/${Math.floor(chapterToUpdate)}/0/${this.token}`,
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
				url: `${AnimePlanetAPI}/rate/manga/${id}/${apScore}/${this.token}`,
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
		if (!this.inList || !this.token) {
			await log(`Could not sync AnimePlanet: status ${this.status} token ${!!this.token}`);
			return RequestStatus.BAD_REQUEST;
		}
		const id = this.key.id;
		const response = await Runtime.jsonRequest({
			url: `${AnimePlanetAPI}/status/manga/${id}/0/${this.token}`,
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
}

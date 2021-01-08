import { DOM } from '../../Core/DOM';
import { duration, ExportModule, ImportModule } from '../../Core/Module';
import { Options } from '../../Core/Options';
import { Runtime } from '../../Core/Runtime';
import { FoundTitle } from '../../Core/Title';
import { KitsuAPI, KitsuHeaders, KitsuManga, KitsuResponse, KitsuTitle } from '../Class/Kitsu';
import { ActivableKey } from '../Keys';
import { LocalTitle } from '../../Core/Title';

export class KitsuImport extends ImportModule {
	findManga = (included: KitsuManga[], id: string): KitsuManga => {
		for (const manga of included) {
			if (manga.id == id) return manga;
		}
		return included[0]; // never
	};

	execute = async (): Promise<boolean> => {
		const progress = DOM.create('p', { textContent: 'Fetching all titles...' });
		const message = this.interface?.message('loading', [progress]);

		// Get each pages
		let lastPage = false;
		let current = 1;
		let max = 1;
		while (!lastPage) {
			progress.textContent = `Fetching all titles... Page ${current} out of ${max}.`;
			const response = await Runtime.jsonRequest<KitsuResponse>({
				url: `${KitsuAPI}?
						filter[user_id]=${Options.tokens.kitsuUser}&
						filter[kind]=manga&
						fields[libraryEntries]=status,progress,volumesOwned,ratingTwenty,startedAt,finishedAt,manga&
						include=manga&
						fields[manga]=chapterCount,volumeCount,canonicalTitle&
						page[limit]=500&
						page[offset]=${(current - 1) * 500}`,
				headers: KitsuHeaders(),
			});
			if (!response.ok) {
				this.interface?.message('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			if (response.body.errors !== undefined) {
				this.interface?.message(
					'warning',
					'The Request failed, check if you are logged in and your token is valid or retry later.'
				);
				return false;
			}
			const body = response.body;
			// Each row has a data-id field
			for (const title of body.data) {
				if (!title.relationships.manga.data) continue;
				const manga = this.findManga(body.included, title.relationships.manga.data.id);
				const foundTitle: FoundTitle = {
					key: { id: parseInt(title.relationships.manga.data.id) },
					progress: {
						chapter: title.attributes.progress,
						volume: title.attributes.volumesOwned,
					},
					max: {
						chapter: manga.attributes.chapterCount,
						volume: manga.attributes.volumeCount,
					},
					status: KitsuTitle.toStatus(title.attributes.status),
					score: title.attributes.ratingTwenty !== null ? title.attributes.ratingTwenty * 5 : 0,
					start: title.attributes.startedAt ? new Date(title.attributes.startedAt) : undefined,
					end: title.attributes.finishedAt ? new Date(title.attributes.finishedAt) : undefined,
					name: manga.attributes.canonicalTitle,
					mochiKey: parseInt(title.relationships.manga.data.id),
				};
				if (foundTitle.status === Status.COMPLETED) {
					foundTitle.max = {
						chapter: manga.attributes.chapterCount,
						volume: manga.attributes.volumeCount,
					};
				}
				this.found.push(foundTitle);
			}

			// We get 500 entries per page
			max = Math.ceil(body.meta.count / 500);
			lastPage = current >= max;
			current++;
		}
		message?.classList.remove('loading');

		return true;
	};
}

export class KitsuExport extends ExportModule {
	onlineList: {
		[key: string]: {
			libraryEntryId?: number;
			max?: Progress;
		};
	} = {};

	preExecute = async (titles: LocalTitle[]): Promise<boolean> => {
		const message = this.interface?.message('loading', 'Checking current status of each titles...');
		let max = Math.ceil(titles.length / 500);
		for (let current = 1; !this.interface?.doStop && current <= max; current++) {
			const ids = titles.slice((current - 1) * 500, current * 500).map((title) => title.services.ku!.id!);
			const response = await Runtime.jsonRequest<KitsuResponse>({
				url: `${KitsuAPI}
					?filter[user_id]=${Options.tokens.kitsuUser}
					&filter[mangaId]=${ids.join(',')}
					&fields[libraryEntries]=id,manga
					&include=manga
					&fields[manga]=id,chapterCount,volumeCount
					&page[limit]=500`,
				headers: KitsuHeaders(),
			});
			if (!response.ok) {
				message?.classList.remove('loading');
				this.interface?.message('warning', 'The request failed, maybe Kitsu is having problems, retry later.');
				return false;
			}
			const body = response.body;
			for (const title of body.data) {
				const titleId = title.relationships.manga.data?.id;
				if (titleId) {
					this.onlineList[titleId] = {
						libraryEntryId: +title.id,
					};
					const included = response.body.included.find((title) => title.id == titleId);
					if (included) {
						this.onlineList[titleId].max = {} as Progress;
						let addedMax = 0;
						if (typeof included.attributes.chapterCount === 'number' && included.attributes.chapterCount) {
							this.onlineList[titleId].max!.chapter = included.attributes.chapterCount;
							addedMax++;
						}
						if (typeof included.attributes.volumeCount === 'number' && included.attributes.volumeCount) {
							this.onlineList[titleId].max!.volume = included.attributes.volumeCount;
							addedMax++;
						}
						if (!addedMax) delete this.onlineList[titleId].max;
					}
				}
			}
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
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
				localTitle.name || `#${localTitle.services[ActivableKey.Kitsu]!.id}`
			})...`;
			if (average > 0) currentProgress += `\nEstimated time remaining: ${duration((max - current) * average)}.`;
			progress.textContent = currentProgress;
			// Kitsu require a libraryEntryId to update a Title
			const before = Date.now();
			const title = new KitsuTitle({ ...localTitle, key: localTitle.services[ActivableKey.Kitsu] });
			const onlineTitle = this.onlineList[localTitle.services.ku!.id!];
			if (onlineTitle) {
				title.libraryEntryId = onlineTitle.libraryEntryId;
				title.max = onlineTitle.max;
			}
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

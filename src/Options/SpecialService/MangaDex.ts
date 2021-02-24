import { DOM } from '../../Core/DOM';
import { MangaDex } from '../../Core/MangaDex';
import { ModuleInterface } from '../../Core/ModuleInterface';
import { Options } from '../../Core/Options';
import { Runtime } from '../../Core/Runtime';
import { Storage } from '../../Core/Storage';
import { LocalTitle, TitleCollection } from '../../Core/Title';
import { ServiceKey } from '../../Service/Keys';
import { SpecialService } from '../SpecialService';

interface MangaDexAPIResponse {
	code: number;
	status: string;
	data: {
		userId: number;
		mangaId: number;
		mangaTitle: string;
		followType: Status;
		volume: string;
		chapter: string;
		rating: number | null;
	}[];
}

export class MangaDexHelper {
	static createTitle = (): HTMLElement => {
		return DOM.create('span', {
			class: 'manga',
			textContent: 'Manga',
			childs: [
				DOM.create('span', {
					class: 'dex',
					textContent: 'Dex',
				}),
			],
		});
	};
}

export class MangaDexImport extends SpecialService {
	start = async (): Promise<void> => {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.createOptions(this.options);
		moduleInterface.setStyle(MangaDexHelper.createTitle(), ServiceKey.MangaDex);

		// Show the Modal
		moduleInterface.bindFormSubmit(async () => {
			moduleInterface.setOptionsValues(this.options);

			// Check login and get an Username
			let message = moduleInterface.message('loading', 'Fetching all Titles...');
			const response = await Runtime.jsonRequest<MangaDexAPIResponse>({
				url: MangaDex.api('get:user:followed:list'),
			});
			message.classList.remove('loading');
			if (!response.ok) {
				moduleInterface.message(
					'warning',
					`The request failed, maybe MangaDex is having problems or you aren't logged in retry later.`
				);
				return moduleInterface.complete();
			}

			// Add all found Titles
			const titles = new TitleCollection();
			const max = response.body.data.length;
			const progress = DOM.create('p');
			message = moduleInterface.message('loading', [progress]);
			for (let i = 0; !moduleInterface.doStop && i < max; i++) {
				const mdTitle = response.body.data[i];
				progress.textContent = `Converting Title ${i + 1} out of ${max} (#${mdTitle.mangaId})...`;
				const localTitle: Partial<LocalTitle> = { status: mdTitle.followType };
				const titleProgress: Progress = { chapter: parseInt(mdTitle.chapter) };
				const volume = parseFloat(mdTitle.volume);
				if (!isNaN(volume) && volume > 0) titleProgress.volume = volume;
				if (titleProgress.chapter > 0) localTitle.progress = titleProgress;
				if (mdTitle.rating != null) localTitle.score = mdTitle.rating * 10; // 0-10 to 0-100
				if (mdTitle.mangaTitle != null) localTitle.name = mdTitle.mangaTitle;
				titles.add(new LocalTitle(mdTitle.mangaId, localTitle));
			}
			message.classList.remove('loading');
			if (moduleInterface.doStop) return moduleInterface.complete();

			// Mochi
			if (this.options.mochi.active) {
				await this.mochi(titles, moduleInterface);
				if (moduleInterface.doStop) return moduleInterface.complete();
			}

			// Save
			message = moduleInterface.message('loading', 'Saving...');
			if (!this.options.merge.active) {
				await Storage.clear();
				await Options.save();
			} else if (titles.length > 0) {
				titles.merge(await TitleCollection.get(titles.ids));
			}

			// Save
			await titles.persist();
			moduleInterface.message;
			message.classList.remove('loading');
			moduleInterface.message('success', `Imported ${titles.length} Titles !`);
			this.reload();
			moduleInterface.complete();
		});
		moduleInterface.modal.show();
	};
}

export class MangaDexExport extends SpecialService {
	persistTitle = async (
		online: { status: Status; rating: number; progress?: Progress },
		title: LocalTitle
	): Promise<RequestStatus> => {
		// Status
		let status = RequestStatus.SUCCESS;
		if (online.status != title.status) {
			const response = await Runtime.request<RawResponse>({
				url: MangaDex.api('set:title:status', title.key.id!, title.status),
				credentials: 'include',
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
				},
			});
			status = Runtime.responseStatus(response);
		}
		// Score
		if (online.rating != Math.round(title.score / 10)) {
			await Runtime.request<RawResponse>({
				url: MangaDex.api('set:title:rating', title.key.id!, title.score / 10),
				credentials: 'include',
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
				},
			});
		}
		// Progress
		if (
			Options.updateMDProgress &&
			(online.progress?.chapter !== title.progress.chapter || online.progress?.volume !== title.progress.volume)
		) {
			await Runtime.request({
				method: 'POST',
				url: MangaDex.api('update:title:progress', title.key.id!),
				credentials: 'include',
				headers: { 'X-Requested-With': 'XMLHttpRequest' },
				form: {
					volume: title.progress.volume ?? 0,
					chapter: title.progress.chapter ?? 0,
				},
			});
		}
		return status;
	};

	start = async (): Promise<void> => {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.setStyle(MangaDexHelper.createTitle(), ServiceKey.MangaDex);

		// Show the Modal
		moduleInterface.bindFormSubmit(async () => {
			// Check login and get an Username
			let message = moduleInterface.message('loading', 'Fetching all Titles...');
			const response = await Runtime.jsonRequest<MangaDexAPIResponse>({
				url: MangaDex.api('get:user:followed:list'),
			});
			message.classList.remove('loading');
			if (!response.ok) {
				moduleInterface.message(
					'warning',
					'The request failed, maybe MangaDex is having problems, retry later.'
				);
				return moduleInterface.complete();
			}
			// Select Titles
			const allTitles = await TitleCollection.get();
			let titles = allTitles.collection.filter((title) => title.status != Status.NONE);

			// Fetch all Titles already in list to avoid sending extra requests
			message = moduleInterface.message('loading', 'Filtering Titles already on MangaDex List...');
			const onlineList: { [key: string]: { status: Status; rating: number; progress?: Progress } } = {};
			for (const title of response.body.data) {
				onlineList[title.mangaId] = {
					status: title.followType,
					rating: title.rating ?? 0,
				};
				const chapter = parseFloat(title.chapter);
				const volume = parseInt(title.volume);
				if ((!isNaN(chapter) && chapter) || (!isNaN(volume) && volume)) {
					onlineList[title.mangaId].progress = { chapter: chapter ?? 0, volume: volume ?? 0 };
				}
			}
			titles = titles.filter(
				(t) =>
					onlineList[t.key.id!] === undefined ||
					onlineList[t.key.id!].status !== t.status ||
					(t.score > 0 && onlineList[t.key.id!].rating !== Math.round(t.score / 10)) ||
					(Options.updateMDProgress &&
						((t.progress.chapter && onlineList[t.key.id!].progress?.chapter != t.progress.chapter) ||
							(t.progress.volume && onlineList[t.key.id!].progress?.volume != t.progress.volume)))
			);
			message.classList.remove('loading');

			// Export all Titles
			const progress = DOM.create('p');
			message = moduleInterface.message('loading', [progress]);
			let i = 0;
			const max = titles.length;
			for (; !moduleInterface.doStop && i < max; i++) {
				const title = titles[i];
				progress.textContent = `Exporting Title ${i + 1} out of ${max} (${
					title.name ? title.name : 'No Name'
				})`;
				await this.persistTitle(onlineList[title.key.id!], title);
			}
			message.classList.remove('loading');
			moduleInterface.message('success', `Exported ${i} Titles !`);
			moduleInterface.complete();
		});
		moduleInterface.modal.show();
	};
}

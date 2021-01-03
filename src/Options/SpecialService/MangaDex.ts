import { DOM } from '../../Core/DOM';
import { ModuleInterface } from '../../Core/ModuleInterface';
import { Options } from '../../Core/Options';
import { Runtime } from '../../Core/Runtime';
import { LocalStorage } from '../../Core/Storage';
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

	static getUser = async (): Promise<number> => {
		const response = await Runtime.jsonRequest<{
			data: { id: number };
		}>({
			url: `https://mangadex.org/api/v2/user/me`,
			credentials: 'include',
		});
		if (!response.ok) return 0;
		return response.body.data.id;
	};

	static getAllTitles = (user: number): Promise<JSONResponse<MangaDexAPIResponse>> => {
		return Runtime.jsonRequest<MangaDexAPIResponse>({
			url: `https://mangadex.org/api/v2/user/${user}/followed-manga`,
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
			let message = moduleInterface.message('loading', 'Checking login status...');
			const user = await MangaDexHelper.getUser();
			const loggedIn = user !== 0;
			message.classList.remove('loading');
			if (!loggedIn) {
				moduleInterface.message(
					'warning',
					`You need to be logged in on MangaDex to Import your following list !`
				);
				return moduleInterface.complete();
			}

			// Use v2 API to retrieve all follows in one request
			message = moduleInterface.message('loading', 'Fetching all Titles...');
			const response = await MangaDexHelper.getAllTitles(user);
			message.classList.remove('loading');
			if (!response.ok) {
				moduleInterface.message(
					'warning',
					'The request failed, maybe MangaDex is having problems, retry later.'
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
				await LocalStorage.clear();
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
	persistTitle = async (title: LocalTitle): Promise<RequestStatus> => {
		// Status
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${title.key.id}&type=${
				title.status
			}&_=${Date.now()}`,
			credentials: 'include',
			headers: {
				'X-Requested-With': 'XMLHttpRequest',
			},
		});
		// Score
		if (title.score > 0) {
			await Runtime.request<RawResponse>({
				url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_rating&id=${title.key.id}&rating=${
					title.score / 10
				}&_=${Date.now()}`,
				credentials: 'include',
				headers: {
					'X-Requested-With': 'XMLHttpRequest',
				},
			});
		}
		return Runtime.responseStatus(response);
	};

	start = async (): Promise<void> => {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.setStyle(MangaDexHelper.createTitle(), ServiceKey.MangaDex);

		// Show the Modal
		moduleInterface.bindFormSubmit(async () => {
			// Check login and get an Username
			let message = moduleInterface.message('loading', 'Checking login status...');
			const user = await MangaDexHelper.getUser();
			const loggedIn = user !== 0;
			message.classList.remove('loading');
			if (!loggedIn) {
				moduleInterface.message('warning', `You need to be logged in on MangaDex to Export your Save !`);
				return moduleInterface.complete();
			}

			// Select Titles
			const allTitles = await TitleCollection.get();
			let titles = allTitles.collection.filter((title) => title.status != Status.NONE);

			// Fetch all Titles already in list to avoid sending extra requests
			message = moduleInterface.message('loading', 'Filtering Titles already on MangaDex List...');
			const response = await MangaDexHelper.getAllTitles(user);
			if (!response.ok) {
				moduleInterface.message(
					'warning',
					'The request failed, maybe MangaDex is having problems, retry later.'
				);
				return moduleInterface.complete();
			}
			const onlineList: { [key: string]: { status: Status; rating: number } } = {};
			for (const title of response.body.data) {
				onlineList[title.mangaId] = { status: title.followType, rating: title.rating ?? 0 };
			}
			titles = titles.filter(
				(t) =>
					onlineList[t.key.id!] === undefined ||
					onlineList[t.key.id!].status !== t.status ||
					(t.score > 0 && onlineList[t.key.id!].rating !== Math.round(t.score / 10))
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
				if (
					onlineList[title.key.id!] === undefined ||
					onlineList[title.key.id!].status !== title.status ||
					(title.score > 0 && onlineList[title.key.id!].rating !== title.score)
				) {
					await this.persistTitle(title);
				}
			}
			message.classList.remove('loading');
			moduleInterface.message('success', `Exported ${i + 1} Titles !`);
			moduleInterface.complete();
		});
		moduleInterface.modal.show();
	};
}

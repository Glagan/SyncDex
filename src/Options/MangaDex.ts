import { DOM } from '../Core/DOM';
import { ModuleOptions } from '../Core/Module';
import { ModuleInterface } from '../Core/ModuleInterface';
import { Options } from '../Core/Options';
import { Runtime } from '../Core/Runtime';
import { StaticKey, StaticName } from '../Core/Service';
import { LocalStorage } from '../Core/Storage';
import { LocalTitle, TitleCollection } from '../Core/Title';
import { OptionsManager } from './OptionsManager';
import { SpecialService } from './SpecialService';

interface MangaDexAPIResponse {
	code: number;
	status: string;
	data: {
		userId: number;
		mangaId: number;
		followType: Status;
		volume: string;
		chapter: string;
		rating: number | null;
	}[];
}

export class MangaDex extends SpecialService {
	user: number = 0;

	loggedIn = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/about`,
			credentials: 'include',
		});
		if (!response.ok) return Runtime.responseStatus(response);
		try {
			const parser = new DOMParser();
			const body = parser.parseFromString(response.body, 'text/html');
			const profileLink = body.querySelector('a[href^="/user/"]');
			if (profileLink === null) {
				throw 'Could not find Profile link';
			}
			const res = /\/user\/(\d+)\//.exec(profileLink.getAttribute('href') ?? '');
			if (res === null) {
				throw 'Could not find User ID';
			}
			this.user = parseInt(res[1]);
			return RequestStatus.SUCCESS;
		} catch (error) {
			return RequestStatus.FAIL;
		}
	};

	start = async (): Promise<void> => {
		// Create a ModuleInterface from scratch
		const moduleInterface = new ModuleInterface();
		moduleInterface.createOptions(this.options);
		moduleInterface.setStyle(DOM.text(StaticName.MangaDex), StaticKey.MangaDex);

		// Show the Modal
		moduleInterface.bindFormSubmit(async () => {
			// Check login and get an Username
			let message = moduleInterface.message('loading', 'Checking login status...');
			const loggedIn = (await this.loggedIn()) === RequestStatus.SUCCESS;
			message.classList.remove('loading');
			if (!loggedIn || this.user == 0) {
				moduleInterface.message(
					'warning',
					`You need to be logged in on MangaDex to Import your following list !`
				);
				return moduleInterface.complete();
			}

			// Use v2 API to retrieve all follows in one request, nice
			// The only problem is there is no names for each titles
			// But the API has the current progress while the /list page doesn't
			message = moduleInterface.message('loading', 'Fetching all Titles...');
			const response = await Runtime.jsonRequest<MangaDexAPIResponse>({
				url: `https://mangadex.org/api/v2/user/${this.user}/followed-manga`,
			});
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
				titles.add(new LocalTitle(mdTitle.mangaId, localTitle));
			}
			message.classList.remove('loading');
			if (moduleInterface.doStop) return moduleInterface.complete();

			// Save
			message = moduleInterface.message('loading', 'Saving...');
			if (!this.options.merge.active) {
				await LocalStorage.clear();
				await Options.save();
			} else if (titles.length > 0) {
				titles.merge(await TitleCollection.get(titles.ids));
			}

			// TODO: Mochi

			// Save
			await titles.persist();
			moduleInterface.message;
			message.classList.remove('loading');
			moduleInterface.message('success', `Imported ${titles.length} Titles !`);
			OptionsManager.instance.reload();
			moduleInterface.complete();
		});
		moduleInterface.modal.show();
	};
}

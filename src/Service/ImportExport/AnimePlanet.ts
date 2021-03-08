import { DOM } from '../../Core/DOM';
import { duration, ExportModule, ImportModule } from '../../Core/Module';
import { Http } from '../../Core/Http';
import { LocalTitle } from '../../Core/Title';
import { AnimePlanet, AnimePlanetTitle } from '../Class/AnimePlanet';
import { ActivableKey } from '../Keys';

export class AnimePlanetImport extends ImportModule {
	preExecute = async (): Promise<boolean> => {
		if (AnimePlanet.username == '') {
			this.interface?.message('error', 'Username not found while checking if logged in.');
			return false;
		}
		const message = this.interface?.message('loading', 'Setting list type...');
		const response = await Http.get(
			`https://www.anime-planet.com/users/${AnimePlanet.username}/manga/reading?sort=title&mylist_view=list`,
			{ credentials: 'include' }
		);
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
			const response = await Http.get(
				`https://www.anime-planet.com/users/${AnimePlanet.username}/manga?sort=title&page=${current}`,
				{ credentials: 'include' }
			);
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
						mochiKey: parseInt(form.dataset.id as string),
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
			if (response <= ResponseStatus.CREATED) this.summary.valid++;
			else this.summary.failed.push(localTitle);
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
	};
}

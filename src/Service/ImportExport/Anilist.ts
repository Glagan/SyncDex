import { DOM } from '../../Core/DOM';
import { duration, ExportModule, ImportModule } from '../../Core/Module';
import { Http } from '../../Core/Http';
import { LocalTitle } from '../../Core/Title';
import { AnilistAPI, AnilistHeaders, AnilistTitle, AnilistStatus, AnilistDate } from '../Class/Anilist';
import { ActivableKey } from '../Keys';

interface AnilistViewerResponse {
	data: {
		Viewer: {
			name: string;
		};
	};
}

interface AnilistListTitle {
	mediaId: number;
	status: AnilistStatus;
	progress: number;
	progressVolumes: number;
	startedAt: AnilistDate;
	completedAt: AnilistDate;
	score: number | null;
	media: {
		title: {
			userPreferred: string;
		};
		chapters: number | null;
		volumes: number | null;
	};
}

interface AnilistListResponse {
	data: {
		MediaListCollection: {
			lists: {
				name: string;
				entries: AnilistListTitle[];
			}[];
		};
	};
}

export class AnilistImport extends ImportModule {
	static viewerQuery = `
		query {
			Viewer {
				name
			}
		}`.replace(/\n\t+/g, ' ');

	static listQuery = `
		query ($userName: String) {
			MediaListCollection(userName: $userName, type: MANGA) {
				lists {
					entries {
						id
						mediaId
						status
						score(format: POINT_100)
						progress
						progressVolumes
						startedAt {
							year
							month
							day
						}
						completedAt {
							year
							month
							day
						}
						media {
							title {
								userPreferred
							}
							chapters
							volumes
						}
					}
				}
			}
		}`.replace(/\n\t+/g, ' '); // Require $userName
	username: string = '';

	async preExecute(): Promise<boolean> {
		// Find required username
		const viewerResponse = await Http.json(AnilistAPI, {
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistImport.viewerQuery,
			}),
		});
		if (!viewerResponse.ok) {
			this.interface?.message(
				'warning',
				`The request failed, maybe Anilist is having problems or your token expired, retry later.`
			);
			return false;
		}
		this.username = (viewerResponse.body as AnilistViewerResponse).data.Viewer.name;
		return true;
	}

	async execute(): Promise<boolean> {
		// Get list of *all* titles
		const message = this.interface?.message('loading', 'Fetching all titles...');
		const response = await Http.json<AnilistListResponse>(AnilistAPI, {
			method: 'POST',
			headers: AnilistHeaders(),
			body: JSON.stringify({
				query: AnilistImport.listQuery,
				variables: {
					userName: this.username,
				},
			}),
		});
		message?.classList.remove('loading');
		if (response.code >= 500 || !response.body) {
			this.interface?.message('warning', 'The request failed, maybe Anilist is having problems, retry later.');
			return false;
		} else if (response.code >= 400) {
			this.interface?.message('warning', 'Bad Request, check if your token is valid.');
			return false;
		}
		if (this.interface?.doStop) return false;

		// Transform to array
		const body = response.body;
		for (const list of body.data.MediaListCollection.lists) {
			for (const entry of list.entries) {
				this.found.push({
					key: { id: entry.mediaId },
					progress: {
						chapter: entry.progress,
						volume: entry.progressVolumes,
					},
					max: {
						chapter: entry.media.chapters ?? undefined,
						volume: entry.media.volumes ?? undefined,
					},
					name: entry.media.title.userPreferred,
					status: AnilistTitle.toStatus(entry.status),
					start: AnilistTitle.dateFromAnilist(entry.startedAt),
					end: AnilistTitle.dateFromAnilist(entry.completedAt),
					score: entry.score ? entry.score : 0,
					mochiKey: entry.mediaId,
				});
			}
		}
		return true;
	}
}

export class AnilistExport extends ExportModule {
	extendOptions(): void {
		this.options.merge = {
			description: 'Merge with current external Anilist save',
			display: true,
			default: true,
		};
	}

	async execute(titles: LocalTitle[]): Promise<boolean> {
		const max = titles.length;
		this.interface?.message('default', `Exporting ${max} Titles...`);
		const progress = DOM.create('p');
		const message = this.interface?.message('loading', [progress]);
		let average = 0;
		for (let current = 0; !this.interface?.doStop && current < max; current++) {
			const localTitle = titles[current];
			let currentProgress = `Exporting Title ${current + 1} out of ${max} (${
				localTitle.name || `#${localTitle.services[ActivableKey.Anilist]!.id}`
			})...`;
			if (average > 0) currentProgress += `\nEstimated time remaining: ${duration((max - current) * average)}.`;
			progress.textContent = currentProgress;
			const before = Date.now();
			const title = new AnilistTitle({ ...localTitle, key: localTitle.services[ActivableKey.Anilist] });
			const response = await title.persist();
			if (average == 0) average = Date.now() - before;
			else average = (average + (Date.now() - before)) / 2;
			if (response <= ResponseStatus.CREATED) this.summary.valid++;
			else this.summary.failed.push(localTitle);
		}
		message?.classList.remove('loading');
		return this.interface ? !this.interface.doStop : true;
	}
}

import { DOM } from '../../Core/DOM';
import { Options } from '../../Core/Options';
import { LocalTitle, TitleCollection } from '../../Core/Title';
import { dateFormat, injectScript, progressFromString, progressToString } from '../../Core/Utility';
import { Page } from '../Page';
import { History } from '../../Core/History';
import { Runtime } from '../../Core/Runtime';
import { MangaDex } from '../../Core/MangaDex';
import { debug, TryCatch } from '../../Core/Log';

interface FollowPageResult {
	titles: { [key: number]: number };
	isLastPage: boolean;
	maxPage: number;
	requestTime: number;
	code: number;
}

export class HistoryPage extends Page {
	async fetchFollowPage(page: number): Promise<FollowPageResult | false> {
		const before = Date.now();
		const response = await Runtime.jsonRequest<{
			data: {
				chapters: {
					id: number;
					hash: string;
					mangaId: number;
					mangaTitle: string;
					volume: string;
					chapter: string;
					title: string;
				}[];
			};
		}>({
			url: MangaDex.api('get:user:followed:updates', page),
			method: 'GET',
			cache: 'no-cache',
			credentials: 'include',
			redirect: 'follow',
		});
		const result: FollowPageResult = {
			titles: {},
			isLastPage: false,
			maxPage: 0,
			requestTime: Date.now() - before,
			code: response.code,
		};
		if (response.code >= 200 && response.code < 400) {
			const body = response.body;
			// Get titles
			for (const chapter of body.data.chapters) {
				const id = chapter.mangaId;
				const progressChapter = parseFloat(chapter.chapter);
				if (isNaN(id) || isNaN(progressChapter)) continue;
				if (result.titles[id] === undefined) {
					result.titles[id] = progressChapter;
				} else {
					result.titles[id] = Math.max(result.titles[id], progressChapter);
				}
			}
			// Last page
			result.isLastPage = body.data.chapters.length < 100;
			if (result.isLastPage) result.maxPage = page;
			// else result.maxPage = body.meta.lastPage;
		} else {
			result.isLastPage = true;
			SimpleNotification.error({
				title: 'MangaDex Error',
				text: `There was an error while making a request to **MangaDex**, retry later.\ncode: ${result.code}`,
			});
			return false;
		}
		return result;
	}

	async processFollowPage(
		titles: { [key: number]: number },
		loaded: number[],
		localTitles: TitleCollection,
		historyCards: { [key: number]: HTMLElement },
		found: string[]
	) {
		const foundIds = Object.keys(titles).map((id) => parseInt(id));
		let titleIds = foundIds.filter((id) => {
			return loaded.indexOf(id) < 0;
		});
		// Update local data for new found titles
		if (titleIds.length > 0) {
			loaded.push(...titleIds);
			localTitles.merge(await TitleCollection.get(titleIds));
		}
		const toSave = new TitleCollection();
		for (const id in titles) {
			// Only update if the title is in local save and has an history card
			const title = localTitles.find(parseInt(id));
			if (!title) continue;
			const highestChapter = Math.max(titles[id], title.highest || 0);
			// Update highest chapter for the titles
			if (!title.highest || title.highest < highestChapter) {
				title.highest = highestChapter;
				toSave.add(title);
			}
			if (title.status !== Status.NONE && historyCards[id] !== undefined) {
				if (highestChapter <= title.chapter) {
					historyCards[id].classList.remove('history-down');
					historyCards[id].classList.add('history-up');
				} else if (highestChapter > title.chapter) {
					historyCards[id].classList.remove('history-up');
					historyCards[id].classList.add('history-down');
				}
				if (found.indexOf(id) < 0) {
					found.push(id);
				}
			}
		}
		// Save updated titles every loop if the user reload the History.page
		if (toSave.length > 0) await toSave.persist();
	}

	@TryCatch(Page.errorNotification)
	async run() {
		console.log('SyncDex :: History Page');
		if (!Options.biggerHistory) return;

		// Load Titles
		const titles = await TitleCollection.get(History.ids);

		// Helper function
		const container = document.getElementById('history')!;
		const infoNode = container.querySelector('p')!;
		infoNode.textContent = '';
		DOM.append(
			infoNode,
			DOM.create('p', {
				childs: [
					DOM.create('span', { class: 'help history-down', textContent: 'Blue' }),
					DOM.space(),
					DOM.text('Higher chapter available'),
				],
			}),
			DOM.create('p', {
				childs: [
					DOM.create('span', { class: 'help history-up', textContent: 'Green' }),
					DOM.space(),
					DOM.text('Latest chapter read'),
				],
			})
		);

		// Add current elements to the history - first one is inserted last
		const currentHistory = Array.from(
			document.querySelectorAll<HTMLElement>('.large_logo.rounded.position-relative.mx-1.my-2')
		).reverse();
		const addedTitles = new TitleCollection();
		for (const node of currentHistory) {
			const chapterLink = node.querySelector<HTMLAnchorElement>(`a[href^='/chapter/']`)!;
			const titleLink = node.querySelector<HTMLAnchorElement>(`a[href^='/title/']`)!;
			const id = parseInt(/\/title\/(\d+)(?:\/.+)?/.exec(titleLink.href)![1]);
			const chapter = parseInt(/\/chapter\/(\d+)/.exec(chapterLink.href)![1]);
			// Update lastChapter and create title if there is one
			const wasInHistory = History.find(id) >= 0;
			const title = wasInHistory ? titles.find(id) : await LocalTitle.get(id);
			if (title) {
				const progress = progressFromString(chapterLink.textContent!);
				if (isNaN(progress.chapter)) continue;
				if (!title.history) title.history = progress;
				if (title.lastChapter !== chapter) title.lastChapter = chapter;
				if (!title.inList) {
					title.name = node.querySelector<HTMLElement>('.manga_title')!.textContent!;
					title.progress = progress;
					addedTitles.add(title);
				}
				if (!wasInHistory) {
					titles.add(title);
					History.add(id);
				}
			}
		}
		infoNode.appendChild(DOM.text(`Your last ${History.ids.length} opened titles are listed below.`));
		await addedTitles.persist();
		await History.save();

		// Display History
		const historyCards: { [key: number]: HTMLElement } = {};
		for (const id of History.ids) {
			const title = titles.find(id);
			if (title !== undefined && title.history !== undefined) {
				const exist = container.querySelector(`a[href^='/title/${id}']`);
				let card: HTMLElement;
				if (!exist) {
					card = this.buildCard(title);
					container.insertBefore(card, container.lastElementChild);
				} else card = exist.parentElement!.parentElement!;
				this.updateCard(card, title);
				this.highlight(card, title);
				historyCards[id] = card;
			}
		}

		// Activate Tooltips
		injectScript(() => {
			// prettier-ignore
			/// @ts-ignore
			$(() => { $('[data-toggle="tooltip"]').tooltip(); });
		});

		// Initialize Check -- Limit to every 24 hours
		const initialized = History.last === undefined;
		let pauseTimer = false;
		if (History.last === undefined || Date.now() - History.last >= 24 * 60 * 60 * 1000) {
			const alert = DOM.create('div', {
				class: 'alert alert-primary',
				textContent: initialized
					? `You refreshed your history more than 24h ago and you can refresh it again.
						It is not recommended to do it often, and it does nothing if you didn't add new titles to your MangaDex list.`
					: `You never initialized your History.
						It is recommend to do it at least once to highlight every cards.`,
			});
			let busy = false;
			const refreshButton = DOM.create('button', {
				class: 'btn btn-primary',
				textContent: `Refresh${History.page ? ` (Continue from page ${History.page})` : ''}`,
				events: {
					click: async (event) => {
						event.preventDefault();
						if (!busy) {
							refreshButton.disabled = true;
							busy = true;
							alert.classList.add('hidden', 'full');
							const firstRow = document.createElement('span');
							const secondRow = document.createElement('span');
							const progress = DOM.create('div', {
								class: 'alert alert-secondary loading',
								childs: [firstRow, DOM.create('br'), secondRow],
							});
							alert.parentElement!.insertBefore(progress, alert.nextElementSibling!);
							pauseTimer = true;
							// Fetch ALL pages until it is done
							const historySize = History.ids.length;
							const localTitles = new TitleCollection();
							const found: string[] = [];
							if (History.page === undefined) History.page = 1;
							let alreadyLoaded: number[] = [];
							let average = 0;
							let maxPage = 1;
							const before = Date.now();
							while (true) {
								// Display loading status
								firstRow.textContent = `Loading Follow page ${History.page}, found ${found.length} out of ${historySize} Titles.`;
								// Calculate estimated remaining time
								/*if (History.page > 1) {
									const estimated = Math.floor(((1500 + average) * (maxPage - History.page)) / 1000);
									const disp = [];
									if (estimated >= 60) disp.push(`${Math.floor(estimated / 60)}min `);
									disp.push(`${estimated % 60}s`);
									secondRow.textContent = `Estimated time to complete ${disp.join('')}.`;
									await new Promise((resolve) => setTimeout(resolve, 1500));
								}*/
								const res = await this.fetchFollowPage(History.page);
								if (res === false) break;
								const { titles, isLastPage, requestTime } = res;
								maxPage = res.maxPage;
								await this.processFollowPage(titles, alreadyLoaded, localTitles, historyCards, found);
								/*if (History.page == 1) {
									average = requestTime;
								} else average = (average + requestTime) / 2;*/
								await History.save();
								if (isLastPage) break;
								History.page++;
							}
							// Update with initializedHistory and the last time
							if (History.page == maxPage) {
								History.last = Date.now();
								History.page = undefined;
							}
							await History.save();
							// Done
							pauseTimer = false;
							progress.className = 'alert alert-success';
							const totalTime = Math.floor((Date.now() - before) / 1000);
							const disp = [];
							if (totalTime >= 60) disp.push(`${Math.floor(totalTime / 60)}min `);
							disp.push(`${totalTime % 60}s`);
							progress.textContent = `Done ! ${
								History.page ? History.page : maxPage
							} pages were loaded in ${disp.join('')}.`;
							const closeButton = DOM.create('button', {
								class: 'btn btn-primary',
								textContent: 'Close',
								events: {
									click: (event) => {
										event.preventDefault();
										progress.remove();
									},
								},
							});
							DOM.append(progress, DOM.space(), closeButton);
							alert.remove();
							busy = false;
							refreshButton.disabled = false;
							refreshButton.remove();
						}
					},
				},
			});
			DOM.append(alert, DOM.space(), refreshButton);
			infoNode.parentElement!.insertBefore(alert, infoNode);
		}

		// Check status and update highlight every 30min
		if (Options.chapterStatus) {
			const timer = DOM.create('span', { textContent: '30min' });
			const statusRow = DOM.create('p', { class: 'p-2' });
			infoNode.parentElement!.insertBefore(statusRow, infoNode.nextElementSibling);
			const checkHistoryLatest = async () => {
				let page = 1;
				const localTitles = new TitleCollection();
				const alreadyLoaded: number[] = [];
				const found: string[] = [];
				while (page <= 2) {
					// Display loading status
					statusRow.textContent = `Loading Follow page ${page} out of 2.`;
					// Wait between MangaDex requests
					if (page > 1) {
						await new Promise((resolve) => setTimeout(resolve, 1500));
					}
					const res = await this.fetchFollowPage(page);
					if (res === false) break;
					const { titles, isLastPage } = res;
					await this.processFollowPage(titles, alreadyLoaded, localTitles, historyCards, found);
					await History.save();
					if (isLastPage) break;
					page++;
				}
				statusRow.textContent = '';
				DOM.append(statusRow, DOM.text('Next check in'), DOM.space(), timer, DOM.text('.'));
				// Add 30min timeout for the next update
				let untilRefresh = 1800;
				const interval = setInterval(() => {
					if (pauseTimer) return;
					untilRefresh--;
					const min = Math.floor(untilRefresh / 60);
					const sec = Math.floor(untilRefresh % 60);
					timer.textContent = `${min ? `${min}min` : ''}${min && sec ? ' ' : ''}${sec ? `${sec}s` : ''}`;
					if (untilRefresh == 0) {
						clearInterval(interval);
						checkHistoryLatest();
					}
				}, 1000);
			};
			checkHistoryLatest();
		}
	}

	buildCard(title: LocalTitle): HTMLElement {
		const chapterLink = DOM.create('a', {
			class: 'white',
			href: `/chapter/${title.lastChapter}`,
			textContent: progressToString(title.history!),
		});
		if (!title.lastChapter) {
			chapterLink.href = '#';
			chapterLink.style.color = 'rgb(255, 167, 0)';
			chapterLink.insertBefore(DOM.space(), chapterLink.firstChild);
			chapterLink.insertBefore(DOM.icon('times-circle'), chapterLink.firstChild);
			chapterLink.title = 'Missing Link';
		}
		return DOM.create('div', {
			class: 'large_logo rounded position-relative mx-1 my-2 has-transition',
			childs: [
				DOM.create('div', {
					class: 'hover',
					childs: [
						DOM.create('a', {
							href: `/title/${title.key.id}`,
							childs: [
								DOM.create('img', {
									class: 'rounded',
									title: title.name,
									src: `/images/manga/${title.key.id}.large.jpg`,
									css: { width: '100%' },
								}),
							],
						}),
					],
				}),
				DOM.create('div', {
					class: 'car-caption px-2 py-1',
					childs: [
						DOM.create('p', {
							class: 'text-truncate m-0',
							childs: [
								DOM.create('a', {
									class: 'manga_title white',
									title: title.name,
									href: `/title/${title.key.id}`,
									textContent: title.name,
								}),
							],
						}),
						DOM.create('p', {
							class: 'text-truncate m-0',
							childs: [chapterLink],
						}),
					],
				}),
			],
		});
	}

	updateCard(card: HTMLElement, title: LocalTitle) {
		card.dataset.toggle = 'tooltip';
		card.dataset.placement = 'bottom';
		card.dataset.html = 'true';
		const content = [];
		if (!title.lastChapter) {
			content.push(`<span style='color:rgb(255,167,0)'>Missing chapter link</span>`);
		}
		if (title.lastTitle) {
			content.push('Last visit', dateFormat(new Date(title.lastTitle), true));
		}
		if (title.lastRead) {
			content.push(
				'Last read',
				`<span style='color:rgb(51,152,182)'>${dateFormat(new Date(title.lastRead), true)}</span>`
			);
		}
		card.title = content.join('<br>');
	}

	highlight(card: HTMLElement, title: LocalTitle) {
		if (title.highest) {
			if (title.highest <= title.chapter) {
				card.classList.add('history-up');
			} else if (title.highest > title.chapter) {
				card.classList.add('history-down');
			}
		}
	}
}

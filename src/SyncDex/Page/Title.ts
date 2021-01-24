import { AppendableElement, DOM } from '../../Core/DOM';
import { debug, LogExecTime, TryCatch } from '../../Core/Log';
import { MangaDex } from '../../Core/MangaDex';
import { Mochi } from '../../Core/Mochi';
import { Options } from '../../Core/Options';
import { Runtime } from '../../Core/Runtime';
import { Service } from '../../Core/Service';
import { SyncModule } from '../../Core/SyncModule';
import { iconToService, LocalTitle, MissableField, StatusMap, Title } from '../../Core/Title';
import { TitleEditor } from '../../Core/TitleEditor';
import { dateCompare, dateFormat, isDate, progressToString } from '../../Core/Utility';
import { Services } from '../../Service/Class/Map';
import { ActivableKey, ServiceKey, StaticKey } from '../../Service/Keys';
import { ChapterRow } from '../ChapterRow';
import { Overview, OverviewKey } from '../Overview';
import { Page } from '../Page';

interface MangaDexExtendedManga extends MangaDexSimpleManga {
	altTitles: string;
	description: string;
	artist: string[];
	author: string[];
	publication: {
		language: string;
		status: Status;
		demographic: number;
	};
	relations: {
		id: number;
		title: string;
		type: number;
		isHentai: boolean;
	}[];
	ratings: {
		bayesian: number;
		mean: number;
		users: number;
	};
	views: number;
	follows: number;
	comments: number;
	lastUploaded: number;
}

interface MangaDexTitleWithChaptersResponse {
	data: { manga: MangaDexExtendedManga; chapters: MangaDexChapter[]; groups: { id: number; name: string }[] };
}

class ServiceOverview {
	key: OverviewKey;
	tab: HTMLLIElement;
	body: HTMLElement;
	content: HTMLElement;
	manage: HTMLElement;
	refreshButton: HTMLButtonElement;
	syncButton: HTMLElement;

	tabIcon?: HTMLElement;
	syncOverlay?: HTMLElement;

	static readonly missingFieldsMap: { [key in MissableField]: string } = {
		volume: 'Volume',
		start: 'Start Date',
		end: 'Finish Date',
		score: 'Score',
	};

	constructor(key: OverviewKey) {
		this.key = key;
		this.tab = DOM.create('li', {
			class: `tab ${key}`,
			childs: [
				DOM.create('img', { src: Runtime.icon(key) }),
				DOM.space(),
				key == ServiceKey.SyncDex ? DOM.text('SyncDex') : Services[key].createTitle(),
			],
		});
		this.content = DOM.create('div', { class: 'content', textContent: 'Loading...' });
		this.manage = DOM.create('div', { class: 'manage' });
		this.body = DOM.create('div', { class: 'body hidden' });
		DOM.append(this.body, this.content, this.manage);
		if (Options.services[0] == key) this.tab.classList.add('main');
		this.refreshButton = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('download'), DOM.space(), DOM.text('Refresh')],
		});
		this.syncButton = DOM.create('button', {
			class: 'btn btn-primary sync-button',
			childs: [DOM.icon('sync-alt'), DOM.space(), DOM.text('Sync')],
		});
	}

	overviewRow = <K = Date | number | string>(icon: string, name: string, content?: K, original?: K): HTMLElement => {
		const nameHeader = DOM.create('span', { textContent: name });
		const row = DOM.create('div', {
			class: icon == 'ban' ? 'helper' : undefined,
			childs: [DOM.create('i', { class: `fas fa-${icon}` }), DOM.space(), nameHeader],
		});
		// Display value
		if (content !== undefined) {
			DOM.append(
				row,
				DOM.space(),
				DOM.create('span', {
					textContent: `${isDate(content) ? dateFormat(content) : content}`,
				})
			);
			// Helper with message if there is no value
		} else nameHeader.className = 'helper';
		// Display difference between synced value
		if (
			original !== undefined &&
			(content === undefined ||
				(isDate(content) && isDate(original) && !dateCompare(content, original)) ||
				(typeof content === 'number' &&
					typeof original === 'number' &&
					Math.floor(content) != Math.floor(original)) ||
				(typeof content === 'string' && typeof original === 'string' && content != original))
		) {
			row.lastElementChild!.classList.add('not-synced');
			// Append synced value next to the not synced value
			DOM.append(
				row,
				DOM.space(),
				DOM.create('span', {
					textContent: `${
						isDate(original)
							? dateFormat(original)
							: typeof original === 'number'
							? Math.floor(original)
							: original
					}`,
					class: 'synced',
				})
			);
		}
		return row;
	};

	/**
	 * Create a list of all values for the Media.
	 */
	overview = (title: Title, original: LocalTitle | undefined, parent: HTMLElement): void => {
		if (!title.loggedIn) {
			parent.appendChild(
				DOM.create('div', {
					class: 'alert alert-danger',
					textContent: 'You are not Logged In.',
				})
			);
			return;
		}
		if (title.inList) {
			const missingFields = title.missingFields;
			const rows: HTMLElement[] = [];
			if (original && title.status != original.status) {
				rows.push(
					DOM.create('div', {
						class: `status st${title.status}`,
						childs: [
							DOM.create('span', { class: 'not-synced', textContent: StatusMap[title.status] }),
							DOM.create('div', {
								class: `status st${original.status}`,
								textContent: StatusMap[original.status],
							}),
						],
					})
				);
			} else {
				rows.push(
					DOM.create('div', { class: `status st${title.status}`, textContent: StatusMap[title.status] })
				);
			}
			rows.push(this.overviewRow('bookmark', 'Chapter', title.chapter, original?.chapter));
			if (missingFields.indexOf('volume') < 0) {
				if (title.volume) {
					rows.push(this.overviewRow('book', 'Volume', title.volume, original?.volume));
				} else {
					rows.push(this.overviewRow('book', 'No Volume', undefined, original?.volume));
				}
			}
			if (title.start) {
				rows.push(this.overviewRow('calendar-plus', 'Started', title.start, original?.start));
			} else if (missingFields.indexOf('start') < 0) {
				rows.push(this.overviewRow('calendar-plus', 'No Start Date', undefined, original?.start));
			}
			if (title.end) {
				rows.push(this.overviewRow('calendar-check', 'Completed', title.end, original?.end));
			} else if (missingFields.indexOf('end') < 0) {
				rows.push(this.overviewRow('calendar-check', 'No Completion Date', undefined, original?.end));
			}
			if (title.score) {
				rows.push(
					this.overviewRow(
						'star',
						'Scored',
						`${title.score} out of 100`,
						original && original.score > 0 ? `${original.score} out of 100` : undefined
					)
				);
			} else if (missingFields.indexOf('score') < 0) {
				rows.push(
					this.overviewRow(
						'star',
						'Not Scored yet',
						undefined,
						original && original.score > 0 ? `${original.score} out of 100` : undefined
					)
				);
			}
			for (const missingField of missingFields) {
				rows.push(this.overviewRow('ban', `No ${ServiceOverview.missingFieldsMap[missingField]} available.`));
			}
			DOM.append(parent, ...rows);
		} else DOM.append(parent, DOM.text('Not in List.'));
	};

	bind = (syncModule: SyncModule): void => {
		this.refreshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			this.syncing();
			await Options.load();
			await syncModule.refreshService(this.key as ActivableKey);
		});
		this.syncButton.addEventListener('click', async (event) => {
			event.preventDefault();
			this.syncing();
			await syncModule.serviceImport(this.key as ActivableKey);
		});
	};

	static alert = (type: 'warning' | 'danger' | 'info', content: string | AppendableElement[]): HTMLElement => {
		if (typeof content === 'string') {
			return DOM.create('div', {
				class: `alert alert-${type}`,
				textContent: content,
			});
		}
		return DOM.create('div', {
			class: `alert alert-${type}`,
			childs: content,
		});
	};

	setTabIcon = (icon: string): void => {
		if (!this.tabIcon) {
			this.tabIcon = DOM.create('i');
			DOM.append(this.tab, DOM.space());
		}
		this.tabIcon.className = `fas fa-${icon}`;
		DOM.append(this.tab, this.tabIcon);
	};

	setErrorMessage = (res: RequestStatus): void => {
		switch (res) {
			case RequestStatus.MISSING_TOKEN:
				this.content.appendChild(
					ServiceOverview.alert('danger', [
						DOM.text('Missing Token, check your Login Status in the Options.'),
						DOM.space(),
						ServiceOverview.openOptionsButton(),
					])
				);
				break;
			case RequestStatus.BAD_REQUEST:
				this.content.appendChild(
					ServiceOverview.alert('danger', 'Bad Request, if this happen again open an issue.')
				);
				break;
			case RequestStatus.NOT_FOUND:
				this.content.appendChild(
					ServiceOverview.alert('danger', 'The Media was not found on the Service, probably a bad ID.')
				);
				break;
			case RequestStatus.FAIL:
			case RequestStatus.SERVER_ERROR:
				this.content.appendChild(
					ServiceOverview.alert('danger', 'Server Error, the Service might be down, retry later.')
				);
				break;
		}
	};

	syncing = (): void => {
		this.setTabIcon('sync-alt fa-spin');
		if (!this.syncOverlay) {
			this.syncOverlay = DOM.create('div', {
				class: 'syncing',
				childs: [DOM.icon('sync-alt fa-spin'), DOM.space(), DOM.text('Syncing...')],
			});
			this.body.appendChild(this.syncOverlay);
		}
	};

	update = (res: Title | RequestStatus, title: LocalTitle): void => {
		this.clear();
		if (typeof res === 'object') {
			this.overview(res, title, this.content);
			// Display *Sync* button only if the title is out of sync, with auto sync disabled and if the title is in a list
			if (!Options.autoSync && !res.isSyncedWith(title) && title.status !== Status.NONE && res.loggedIn) {
				this.setTabIcon('sync has-error');
				this.manage.appendChild(this.syncButton);
			}
			if (!res.loggedIn) {
				this.setTabIcon('times has-error');
			} else if (!res.inList) {
				this.setTabIcon('bookmark has-error');
			}
		} else {
			this.setTabIcon('times has-error');
			this.setErrorMessage(res);
		}
		this.manage.appendChild(this.refreshButton);
	};

	synced = (): void => {
		if (this.tabIcon) {
			this.tabIcon.remove();
			this.tabIcon = undefined;
			this.tab.lastChild!.remove(); // Remove whitespace
		}
		if (this.syncOverlay) {
			this.syncOverlay.remove();
			this.syncOverlay = undefined;
		}
	};

	activate = (): void => {
		this.tab.classList.add('active');
		this.body.classList.remove('hidden');
	};

	disable = (): void => {
		this.tab.classList.remove('active');
		this.body.classList.add('hidden');
	};

	clear = (): void => {
		DOM.clear(this.content);
		DOM.clear(this.manage);
		if (this.syncOverlay) {
			this.syncOverlay.remove();
			this.syncOverlay = undefined;
		}
		if (this.tabIcon) {
			this.tabIcon.remove();
			this.tabIcon = undefined;
			this.tab.lastChild!.remove(); // Remove whitespace
		}
	};

	static openOptionsButton = (): HTMLButtonElement => {
		return DOM.create('button', {
			class: 'btn btn-primary',
			textContent: 'Open Options',
			events: {
				click: (event) => {
					event.preventDefault();
					Runtime.openOptions();
				},
			},
		});
	};
}

class LocalOverview extends ServiceOverview {
	editButton: HTMLButtonElement;
	quickButtons: HTMLElement;
	startReading: HTMLButtonElement;
	planToRead: HTMLButtonElement;
	completed: HTMLButtonElement;

	constructor() {
		super(StaticKey.SyncDex);
		this.editButton = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('edit'), DOM.space(), DOM.text('Edit')],
		});
		this.quickButtons = DOM.create('div', { class: 'quick-buttons' });
		this.startReading = DOM.create('button', {
			class: 'btn btn-primary',
			childs: [DOM.icon('book-open'), DOM.space(), DOM.text('Start Reading')],
		});
		this.planToRead = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('bookmark'), DOM.space(), DOM.text('Add to Plan to Read')],
		});
		this.completed = DOM.create('button', {
			class: 'btn btn-success',
			childs: [DOM.icon('book'), DOM.space(), DOM.text('Completed')],
		});
		DOM.append(this.quickButtons, this.startReading, DOM.space(), this.planToRead);
	}

	bind = (syncModule: SyncModule): void => {
		this.editButton.addEventListener('click', async (event) => {
			event.preventDefault();
			TitleEditor.create(syncModule, async (updatedIDs) => {
				if (!syncModule.overview) return;
				// Update all overviews if external services IDs were updated
				debug(`Updated IDs after Title Editor ? ${updatedIDs}`);
				if (updatedIDs) {
					syncModule.overview.reset();
					for (const serviceKey of Options.services) {
						const key = syncModule.title.services[serviceKey];
						syncModule.overview.initializeService(serviceKey, key != undefined);
						syncModule.overview.receivedInitialRequest(
							serviceKey,
							syncModule.services[serviceKey]!,
							syncModule
						);
					}
				}
			}).show();
		});
		this.refreshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			await syncModule.title.refresh();
			syncModule.overview?.reset();
			// Initialize SyncModule again if there is new Service IDs
			syncModule.initialize();
			await syncModule.syncLocal();
			await syncModule.syncExternal(true);
		});
		const quickBind = async (event: Event, status: Status): Promise<void> => {
			event.preventDefault();
			syncModule.title.status = status;
			if (status == Status.READING && !syncModule.title.start) {
				syncModule.title.start = new Date();
			} else if (status == Status.COMPLETED) {
				if (!syncModule.title.start) syncModule.title.start = new Date();
				if (!syncModule.title.end) syncModule.title.end = new Date();
			}
			await syncModule.title.persist();
			await syncModule.syncLocal();
			await syncModule.syncExternal(true);
		};
		this.startReading.addEventListener('click', (event) => quickBind(event, Status.READING));
		this.planToRead.addEventListener('click', (event) => quickBind(event, Status.PLAN_TO_READ));
		this.completed.addEventListener('click', (event) => quickBind(event, Status.COMPLETED));
	};

	update = (_res: Title | RequestStatus, title: LocalTitle): void => {
		this.clear();
		if (title.status == Status.NONE) {
			if (title.chapter > 0) {
				this.overview(title, undefined, this.content);
			}
			this.content.appendChild(this.quickButtons);
		} else this.overview(title, undefined, this.content);
		this.manage.appendChild(this.editButton);
		this.manage.appendChild(this.refreshButton);
	};
}

class ChapterList {
	highest: number = 0;
	rows: ChapterRow[] = [];
	languageMap: { [key: string]: string } = {};
	rowLanguages: { code: string; node: HTMLElement }[] = [];
	volumeResetChapter: boolean;
	volumeChapterCount: { [key: number]: number };
	// Flag if there is more than one page if Volume reset chapters
	incomplete: boolean;

	/**
	 * Find each rows, their previous/next and add CSS for animations
	 */
	constructor() {
		const chapterRows = Array.from(document.querySelectorAll<HTMLElement>('.chapter-row')).reverse();
		let lastVolume: number = 0;
		this.volumeResetChapter = false;
		this.volumeChapterCount = {};
		for (const row of chapterRows) {
			if (row.dataset.id == undefined) continue;
			const chapterRow = new ChapterRow(row);
			if (!isNaN(chapterRow.progress.chapter)) {
				this.rows.push(chapterRow);
				// Calculate highest chapter
				if (chapterRow.progress.chapter > this.highest) this.highest = chapterRow.progress.chapter;
			}
			if (lastVolume >= 0) {
				const currentVolume = chapterRow.progress.volume;
				// If there is no volume, volumes can't reset chapters
				if (currentVolume) {
					if (currentVolume != lastVolume) {
						lastVolume = currentVolume;
						// Check if volumes actually reset chapter or abort
						if (currentVolume > 1 && chapterRow.progress.chapter <= 1) {
							this.volumeResetChapter = true;
						} else if (currentVolume > 1) lastVolume = -1;
					}
					// Avoid adding sub chapters
					if (
						chapterRow.progress.chapter >= 1 &&
						Math.floor(chapterRow.progress.chapter) == chapterRow.progress.chapter
					) {
						if (this.volumeChapterCount[currentVolume]) {
							this.volumeChapterCount[currentVolume]++;
						} else this.volumeChapterCount[currentVolume] = 1;
					}
				} else lastVolume = -1;
			}
		}
		this.incomplete = document.querySelector('nav ul li.page-item .page-link') != null;
	}

	update(title: LocalTitle) {
		if (title.volumeResetChapter) {
			let previous = 0;
			for (const row of this.rows) {
				title.updateProgressFromVolumes(row.progress);
				// Add 0.1 or 0.5 to new chapters that are still lower than the previous one
				// Avoid having a lower chapter on a new volume from the previous last chapter that is usually a 0.5
				if (row.progress.chapter <= previous) {
					if (previous - Math.floor(previous) >= 0.5) {
						row.progress.chapter += 0.1;
					} else row.progress.chapter += 0.5;
				}
				row.updateDisplayedProgress();
				previous = row.progress.chapter;
			}
		}
	}

	bind(syncModule: SyncModule): void {
		const title = syncModule.title;
		for (const row of this.rows) {
			row.addManageButtons();

			// Bind chapter list button -- saveOpenedChapters is enabled if it exist
			row.toggleButton?.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.toggleIcon!.classList.contains('fa-minus')) {
					title.removeChapter(row.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter == row.progress.chapter) {
							if (!otherRow.isNext) otherRow.node.style.backgroundColor = '';
							otherRow.disableToggleButton();
						}
					}
				} else {
					title.addChapter(row.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter == row.progress.chapter) {
							if (!otherRow.isNext) otherRow.node.style.backgroundColor = Options.colors.openedChapter;
							otherRow.enableToggleButton();
						}
					}
				}
				await title.persist();
			});

			// Bind Set as Latest button
			let loading = false;
			row.markButton.addEventListener('click', async (event) => {
				event.preventDefault();
				if (loading) return;
				row.markButton.classList.add('loading');
				loading = true;
				if (row.progress.chapter == title.chapter) return;
				const previousState = syncModule.saveState();
				const completed = title.setProgress(row.progress);
				// No need to do anything here, only add or remove chapters from the list
				// Highlight on syncedLocal will fix everything
				if (Options.saveOpenedChapters) {
					title.updateChapterList(row.progress.chapter);
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter < row.progress.chapter) {
							title.addChapter(otherRow.progress.chapter);
						}
					}
				}
				if (Options.biggerHistory) {
					await title.setHistory(row.chapterId);
				}
				await title.persist();
				syncModule.overview?.syncedLocal(title);
				const report = await syncModule.syncExternal(true);
				syncModule.displayReportNotifications(report, { completed: completed }, previousState);
				row.markButton.classList.remove('loading');
				loading = false;
			});
		}
	}

	highlight(title: LocalTitle): void {
		let foundNext = false;
		let nextChapterValue = 0;
		for (const row of this.rows) {
			// Reset
			row.parent.classList.remove('current');
			row.node.style.backgroundColor = '';
			row.isNext = false;
			// Next Chapter is 0 if it exists and it's a new Title or the first next closest
			const isOpened = title.chapters.indexOf(row.progress.chapter) >= 0;
			if (
				(!foundNext &&
					((row.progress.chapter > title.chapter && row.progress.chapter < Math.floor(title.chapter) + 2) ||
						(row.progress.chapter == 0 && title.chapter == 0 && title.status !== Status.COMPLETED))) ||
				(foundNext && nextChapterValue === row.progress.chapter)
			) {
				// * Next Chapter
				row.node.style.backgroundColor = Options.colors.nextChapter;
				row.isNext = true;
				foundNext = true;
				nextChapterValue = row.progress.chapter;
			} else if (title.chapter == row.progress.chapter) {
				// * Current chapter
				row.node.style.backgroundColor = Options.colors.highlights[0];
			} else if (isOpened) {
				// * Opened Chapter
				row.node.style.backgroundColor = Options.colors.openedChapter;
			}
			// Set current state of the Toggle button
			if (row.toggleButton && row.toggleIcon) {
				if (isOpened) {
					row.enableToggleButton();
				} else {
					row.disableToggleButton();
				}
			}
			// Hide Set Latest button
			if (row.progress.chapter == title.chapter) {
				row.parent.classList.add('current');
			}
		}
	}
}

export class TitleOverview extends Overview {
	row: HTMLElement;
	column: HTMLElement;
	serviceList: HTMLUListElement;
	bodies: HTMLElement;
	current?: ServiceOverview;
	mainOverview: LocalOverview;
	overviews: Partial<{ [key in ActivableKey]: ServiceOverview }> = {};
	// MangaDex Status and Score
	mdStatus?: {
		followButton: HTMLButtonElement;
		button: HTMLButtonElement;
		dropdown: HTMLElement;
		unfollow: HTMLAnchorElement;
		list: HTMLAnchorElement[];
	};
	mdScore: {
		button: HTMLButtonElement;
		dropdown: HTMLElement;
		ratings: HTMLAnchorElement[];
	};
	mdProgress: {
		currentVolume: HTMLElement;
		incVolume: HTMLButtonElement;
		inputVolume: HTMLInputElement;
		currentChapter: HTMLElement;
		incChapter: HTMLButtonElement;
		inputChapter: HTMLInputElement;
	};
	chapterList: ChapterList;

	static statusDescription: Partial<{ [key in Status]: [string, string] }> = {
		[Status.READING]: ['eye', 'success'],
		[Status.COMPLETED]: ['check', 'primary'],
		[Status.PAUSED]: ['pause', 'warning'],
		[Status.PLAN_TO_READ]: ['calendar-alt', 'info'],
		[Status.DROPPED]: ['trash', 'danger'],
		[Status.REREADING]: ['eye', 'secondary'],
	};

	constructor() {
		super();
		this.column = DOM.create('div', { class: 'overview col-lg-9 col-xl-10' });
		const isDarkTheme =
			document.querySelector('link[rel="stylesheet"][href*="Dark"]') !== null ||
			document.querySelector('link[rel="stylesheet"][href*="Abyss"]') !== null;
		if (isDarkTheme) this.column.classList.add('dark');
		this.row = DOM.create('div', {
			class: 'row m-0 py-1 px-0 border-top',
			childs: [DOM.create('div', { class: 'col-lg-3 col-xl-2 strong', textContent: 'SyncDex:' }), this.column],
		});
		const row = document.querySelector<HTMLElement>('.reading_progress')!.parentElement!;
		row.parentElement!.insertBefore(this.row, row);
		this.serviceList = DOM.create('ul', { class: 'tabs' });
		this.bodies = DOM.create('div', { class: 'bodies' });
		DOM.append(this.column, this.serviceList, this.bodies);

		// Always create SyncDex Overview
		this.mainOverview = new LocalOverview();
		this.bindOverview(this.mainOverview);
		this.activateOverview(this.mainOverview);

		// Update Status selector if logged in
		const statusButtons = document.querySelectorAll<HTMLAnchorElement>('a.manga_follow_button');
		if (statusButtons.length > 0) {
			this.mdStatus = {
				followButton: DOM.create('button'),
				button: statusButtons[0].parentElement!.previousElementSibling as HTMLButtonElement,
				dropdown: statusButtons[0].parentElement!,
				unfollow: DOM.create('a'),
				list: Array.from(statusButtons),
			};
			// Replace old node to remove all events
			for (const idx in this.mdStatus.list) {
				const oldStatus = this.mdStatus.list[idx];
				const status = oldStatus.cloneNode(true) as HTMLAnchorElement;
				oldStatus.replaceWith(status);
				this.mdStatus.list[idx] = status;
			}
			// Create Follow button if it doesn't exist
			const followButton = document.querySelector<HTMLButtonElement>('button.manga_follow_button');
			if (followButton) {
				const newFollow = followButton.cloneNode(true) as HTMLButtonElement;
				followButton.replaceWith(newFollow);
				this.mdStatus.followButton = newFollow;
			} else {
				this.mdStatus.followButton.className = 'btn btn-secondary';
				DOM.append(
					this.mdStatus.followButton,
					DOM.icon('bookmark fa-fw'),
					DOM.space(),
					DOM.create('span', { class: 'd-none d-xl-inline', textContent: 'Follow' })
				);
			}
			// Create Unfollow button if it doesn't exist
			const unfollowButton = document.querySelector<HTMLAnchorElement>('a.manga_unfollow_button');
			if (unfollowButton) {
				const newUnfollow = unfollowButton.cloneNode(true) as HTMLAnchorElement;
				unfollowButton.replaceWith(newUnfollow);
				this.mdStatus.unfollow = newUnfollow;
			} else {
				this.mdStatus.unfollow.className = 'dropdown-item';
				this.mdStatus.unfollow.href = '#';
				DOM.append(this.mdStatus.unfollow, DOM.icon('bookmark fa-fw'), DOM.text('Unfollow'));
			}
		}

		// Update Score selector
		const ratingButtons = document.querySelectorAll<HTMLAnchorElement>('a.manga_rating_button');
		this.mdScore = {
			button: ratingButtons[0].parentElement!.previousElementSibling as HTMLButtonElement,
			dropdown: ratingButtons[0].parentElement!,
			ratings: [],
		};
		// Replace old node to remove all events
		for (const oldRating of ratingButtons) {
			const rating = oldRating.cloneNode(true) as HTMLAnchorElement;
			oldRating.replaceWith(rating);
			this.mdScore.ratings.unshift(rating);
		}

		// Find MangaDex Progress nodes
		const editProgressForm = document.getElementById('edit_progress_form') as HTMLFormElement;
		const incVolume = document.getElementById('increment_volume') as HTMLButtonElement;
		const incChapter = document.getElementById('increment_chapter') as HTMLButtonElement;
		this.mdProgress = {
			currentVolume: document.getElementById('current_volume') as HTMLElement,
			incVolume: incVolume.cloneNode(true) as HTMLButtonElement,
			inputVolume: editProgressForm.querySelector('#volume') as HTMLInputElement,
			currentChapter: document.getElementById('current_chapter') as HTMLElement,
			incChapter: incChapter.cloneNode(true) as HTMLButtonElement,
			inputChapter: editProgressForm.querySelector('#chapter') as HTMLInputElement,
		};
		// Replace increment buttons
		incVolume.replaceWith(this.mdProgress.incVolume);
		incChapter.replaceWith(this.mdProgress.incChapter);

		// Add Language buttons
		const navTabs = document.querySelector<HTMLElement>('ul.edit.nav.nav-tabs');
		ChapterRow.generateLanguageButtons(navTabs);

		this.chapterList = new ChapterList();
	}

	reset() {
		DOM.clear(this.serviceList);
		DOM.clear(this.bodies);
		this.serviceList.appendChild(this.mainOverview.tab);
		this.bodies.appendChild(this.mainOverview.body);
	}

	bindStatusUpdate = async (event: Event, syncModule: SyncModule, status: Status): Promise<void> => {
		event.preventDefault();
		if (syncModule.mdState.status == status) return;
		if (Options.mdUpdateSyncDex) {
			syncModule.title.status = status;
			await syncModule.title.persist();
			this.syncedLocal(syncModule.title);
			await syncModule.syncExternal(true);
		}
		if (!Options.mdUpdateSyncDex || !Options.updateMD) {
			syncModule.mdState.status = status;
			const response = await syncModule.syncMangaDex(status == Status.NONE ? 'unfollow' : 'status');
			if (response.ok) {
				SimpleNotification.success({ text: '**MangaDex Status** updated.' });
			} else {
				SimpleNotification.error({
					text: `Error while updating **MangaDex Status**.\ncode: ${response.code}`,
				});
			}
		}
	};

	bind = (syncModule: SyncModule): void => {
		this.mainOverview.bind(syncModule);

		// Replace Status
		if (this.mdStatus) {
			this.mdStatus.followButton.addEventListener('click', (event) => {
				this.bindStatusUpdate(event, syncModule, Status.READING);
			});
			this.mdStatus.unfollow.addEventListener('click', (event) => {
				if (confirm('This will remove all Read chapters from MangaDex (the eye icon).\nAre you sure ?')) {
					this.bindStatusUpdate(event, syncModule, Status.NONE);
				}
			});
			for (const row of this.mdStatus.list) {
				const status = parseInt(row.id);
				row.addEventListener('click', async (event) => {
					if (row.classList.contains('disabled')) return;
					this.bindStatusUpdate(event, syncModule, status);
				});
			}
		}

		// Replace ratings
		for (const row of this.mdScore.ratings) {
			const score = parseInt(row.id) * 10;
			row.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.classList.contains('disabled')) return;
				if (Options.mdUpdateSyncDex) {
					syncModule.title.score = score;
					await syncModule.title.persist();
					this.syncedLocal(syncModule.title);
					await syncModule.syncExternal(true);
				}
				if (!Options.mdUpdateSyncDex || !Options.updateMD) {
					syncModule.mdState.score = score;
					const response = await syncModule.syncMangaDex('score');
					if (response.ok) {
						SimpleNotification.success({ text: '**MangaDex Score** updated.' });
					} else {
						SimpleNotification.error({
							text: `Error while updating **MangaDex Score**.\ncode: ${response.code}`,
						});
					}
				}
			});
		}

		// Replace Increment buttons
		this.mdProgress.incVolume.addEventListener('click', async (event) => {
			event.preventDefault();
			if (!syncModule.mdState.progress.volume) {
				syncModule.mdState.progress.volume = 1;
			} else syncModule.mdState.progress.volume++;
			const response = await syncModule.syncMangaDex('progress');
			if (response.ok) {
				SimpleNotification.success({ text: '**MangaDex Progress** updated.' });
				this.mdProgress.currentVolume.textContent = `${syncModule.mdState.progress.volume}`;
				this.mdProgress.inputVolume.value = `${syncModule.mdState.progress.volume}`;
			}
		});
		this.mdProgress.incChapter.addEventListener('click', async (event) => {
			event.preventDefault();
			syncModule.mdState.progress.chapter++;
			const response = await syncModule.syncMangaDex('progress');
			if (response.ok) {
				SimpleNotification.success({ text: '**MangaDex Progress** updated.' });
				this.mdProgress.currentChapter.textContent = `${syncModule.mdState.progress.chapter}`;
				this.mdProgress.inputChapter.value = `${syncModule.mdState.progress.chapter}`;
			}
		});

		this.chapterList.bind(syncModule);
	};

	hasNoServices = (): void => {
		const alert = ServiceOverview.alert(
			'warning',
			`You have no active Services, SyncDex won't sync anything until you activate one.`
		);
		alert.style.marginTop = '8px';
		this.column.appendChild(alert);
		return;
	};

	initializeService = (key: ActivableKey, hasId: boolean): void => {
		if (Options.overviewMainOnly && key !== Options.services[0]) return;
		const overview = this.createOverview(key);
		if (hasId) {
			overview.syncing();
		} else {
			overview.content.textContent = '';
			overview.content.appendChild(
				ServiceOverview.alert(
					'info',
					`No ID for ${Services[key].name}, you can manually add one in the Save Editor.`
				)
			);
			overview.setTabIcon('times has-error');
		}
	};

	receivedInitialRequest = (key: ActivableKey, res: Title | RequestStatus, syncModule: SyncModule): void => {
		const overview = this.overviews[key];
		if (overview) {
			overview.bind(syncModule);
			overview.update(res, syncModule.title);
		}
	};

	receivedAllInitialRequests = (syncModule: SyncModule): void => {
		// Add the *Completed* button only if the title is complete
		if (syncModule.title.max && syncModule.title.max.chapter) {
			DOM.append(this.mainOverview.quickButtons, DOM.space(), this.mainOverview.completed);
		}
	};

	syncingService = (key: ActivableKey): void => {
		const overview = this.overviews[key];
		if (overview) overview.syncing();
	};

	syncedService = (key: ActivableKey, res: Title | RequestStatus, title: LocalTitle): void => {
		const overview = this.overviews[key];
		if (!overview) return;
		overview.synced();
		overview.update(res, title);
	};

	syncingLocal = (): void => {
		this.mainOverview.syncing();
	};

	syncedLocal = (title: LocalTitle): void => {
		this.mainOverview.update(RequestStatus.SUCCESS, title);
		this.mainOverview.synced();
		this.chapterList.highlight(title);
	};

	activateOverview = (overview: ServiceOverview): void => {
		if (this.current) {
			this.current.disable();
			this.column.classList.remove(this.current.key);
		}
		this.current = overview;
		this.current.activate();
		this.column.classList.add(overview.key);
	};

	createOverview = (key: ActivableKey): ServiceOverview => {
		// Remove Previous if there is one
		if (this.overviews[key] !== undefined) {
			this.overviews[key]!.tab.remove();
			this.overviews[key]!.body.remove();
		}
		// Create the new Overview
		const overview = new ServiceOverview(key);
		this.bindOverview(overview);
		this.overviews[key] = overview;
		return overview;
	};

	bindOverview = (overview: ServiceOverview): void => {
		this.serviceList.appendChild(overview.tab);
		this.bodies.appendChild(overview.body);
		overview.tab.addEventListener('click', (event) => {
			event.preventDefault();
			this.activateOverview(overview);
		});
	};

	syncedMangaDex = (type: 'unfollow' | 'status' | 'score' | 'progress', syncModule: SyncModule): void => {
		const dropdown = type == 'score' ? this.mdScore.dropdown : this.mdStatus?.dropdown;
		if (!dropdown) return;
		// Remove old value
		const previous = dropdown.querySelector('.disabled');
		if (previous) previous.classList.remove('disabled');
		// Activate new Status or Rating
		// If we're unfollowing, hide Unfollow and revert to default
		if (this.mdStatus && type == 'unfollow') {
			const buttonContainer = this.mdStatus.dropdown.parentElement!;
			buttonContainer.insertBefore(this.mdStatus.followButton, buttonContainer.firstElementChild);
			this.mdStatus.button.className = 'btn btn-secondary dropdown-toggle dropdown-toggle-split';
			DOM.clear(this.mdStatus.button);
			this.mdStatus.button.appendChild(DOM.create('span', { class: 'sr-only', textContent: 'Toggle Dropdown' }));
			this.mdStatus.unfollow.remove();
		} else if (this.mdStatus && type == 'status') {
			if (syncModule.mdState.status !== Status.NONE) {
				const status = dropdown.querySelector(`[id='${syncModule.mdState.status}']`);
				if (!syncModule.mdState.status || !status) return;
				status.classList.add('disabled');
				// Update button style
				const description = TitleOverview.statusDescription[syncModule.mdState.status]!;
				DOM.clear(this.mdStatus.button);
				DOM.append(
					this.mdStatus.button,
					DOM.icon(`${description[0]} fa-fw`),
					DOM.space(),
					DOM.create('span', {
						class: 'd-none d-xl-inline',
						textContent: StatusMap[syncModule.mdState.status],
					})
				);
				this.mdStatus.button.className = `btn btn-${description[1]} dropdown-toggle`;
				this.mdStatus.dropdown.insertBefore(this.mdStatus.unfollow, this.mdStatus.dropdown.firstElementChild);
				this.mdStatus.followButton.remove();
			}
		} else if (type == 'score') {
			if (syncModule.mdState.score == 0) {
				this.mdScore.ratings[0].classList.add('disabled');
				this.mdScore.button.childNodes[1].textContent = ` `;
			} else {
				const newScore = syncModule.mdState.score < 10 ? 1 : Math.round(syncModule.mdState.score / 10);
				this.mdScore.ratings[newScore].classList.add('disabled');
				this.mdScore.button.childNodes[1].textContent = ` ${newScore} `;
			}
		} else if (type == 'progress') {
			this.mdProgress.currentVolume.textContent = `${syncModule.mdState.progress.volume}`;
			this.mdProgress.inputVolume.value = `${syncModule.mdState.progress.volume}`;
			this.mdProgress.currentChapter.textContent = `${syncModule.mdState.progress.chapter}`;
			this.mdProgress.inputChapter.value = `${syncModule.mdState.progress.chapter}`;
		}
	};
}

export class TitlePage extends Page {
	@LogExecTime
	getMdTitle(id: number): Promise<JSONResponse<MangaDexTitleWithChaptersResponse>> {
		return Runtime.jsonRequest<MangaDexTitleWithChaptersResponse>({
			method: 'GET',
			url: MangaDex.api('get:title', id, { chapters: true }),
			credentials: 'include',
		});
	}

	@TryCatch(Page.errorNotification)
	async run() {
		console.log('SyncDex :: Title');
		const overview = new TitleOverview();

		// Get Title
		const id = parseInt(document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!);
		const title = await LocalTitle.get(id);
		if (!title.inList || title.name === undefined || title.name == '') {
			const headerTitle = document.querySelector('h6.card-header');
			if (headerTitle) title.name = headerTitle.textContent!.trim();
		}
		// Max progress if it's available
		const max: Progress = {} as Progress;
		const maxChapter = document.getElementById('current_chapter');
		if (maxChapter && maxChapter.nextSibling && maxChapter.nextSibling.textContent) {
			const chapter = /\/(\d+)/.exec(maxChapter.nextSibling.textContent);
			if (chapter) max.chapter = parseFloat(chapter[1]);
		}
		const maxVolume = document.getElementById('current_volume');
		if (maxVolume && maxVolume.nextSibling && maxVolume.nextSibling.textContent) {
			const volume = /\/(\d+)/.exec(maxVolume.nextSibling.textContent);
			if (volume) max.volume = parseInt(volume[1]);
		}
		debug(`Found MangaDex max ${progressToString(max)}`);
		// Always Find Services
		let fallback = false;
		if (Options.useMochi) {
			const connections = await Mochi.find(id);
			if (connections !== undefined) {
				Mochi.assign(title, connections);
			} else fallback = true;
		}
		// If Mochi failed or if it's disabled use displayed Services
		const pickLocalServices = !Options.useMochi || fallback;
		const localServices: { [key in ActivableKey]?: [HTMLElement, MediaKey] } = {};
		const informationTable = document.querySelector('.col-xl-9.col-lg-8.col-md-7')!;
		// Look for the "Information:" column
		let informationRow = Array.from(informationTable.children).find(
			(row) => row.firstElementChild?.textContent == 'Information:'
		);
		// Nothing to do if there is no row
		if ((pickLocalServices || Options.linkToServices) && informationRow) {
			const services = informationRow.querySelectorAll<HTMLImageElement>('img');
			for (const serviceIcon of services) {
				const serviceLink = serviceIcon.nextElementSibling as HTMLAnchorElement;
				// Convert icon name to ServiceKey, only since kt is ku
				const serviceKey = iconToService(serviceIcon.src);
				if (serviceKey !== undefined) {
					const id = Services[serviceKey].idFromLink(serviceLink.href);
					localServices[serviceKey] = [serviceLink.parentElement!, id];
					if (pickLocalServices && !title.doForceService(serviceKey)) {
						title.services[serviceKey] = id;
					}
				}
			}
		}

		// Add link to Services if they are missing
		if (Options.linkToServices && !pickLocalServices) {
			// Create a row for the links if there isn't one
			if (!informationRow) {
				informationRow = DOM.create('div', {
					class: 'row m-0 py-1 px-0 border-top',
					childs: [
						DOM.create('div', { class: 'col-lg-3 col-xl-2 strong', textContent: 'Information:' }),
						DOM.create('div', {
							class: 'col-lg-9 col-xl-10',
							childs: [DOM.create('ul', { class: 'list-inline mb-0' })],
						}),
					],
				});
				// Insert before the *Reading Progres* -- and before Overview
				const progressRow = document.querySelector('.reading_progress')!.parentElement!;
				progressRow.parentElement!.insertBefore(informationRow, progressRow);
			}
			const serviceList = informationRow.querySelector('ul')!;
			// Add Links
			for (const key of Object.values(ActivableKey)) {
				const localService = localServices[key];
				if (title.services[key] == undefined) continue;
				const serviceName = Services[key].name;
				// If there is no localService add a link
				if (localService == undefined) {
					const link = DOM.create('li', {
						class: 'list-inline-item',
						childs: [
							DOM.create('img', { src: Runtime.icon(key), title: serviceName }),
							DOM.space(),
							DOM.create('a', {
								href: Services[key].link(title.services[key]!),
								target: '_blank',
								textContent: `${serviceName} (SyncDex)`,
							}),
						],
					});
					serviceList.appendChild(link);
				} else if (!Services[key].compareId(title.services[key]!, localService[1])) {
					DOM.append(
						localService[0],
						DOM.space(),
						DOM.create('a', {
							href: Services[key].link(title.services[key]!),
							target: '_blank',
							textContent: '(SyncDex)',
						})
					);
				}
			}
		}

		debug(`Volume reset chapters ? ${overview.chapterList.volumeResetChapter || title.volumeResetChapter}`);
		if (overview.chapterList.volumeResetChapter || title.volumeResetChapter) {
			// If we have all available chapters, we can update the volumeChapterCount of the title
			if (!overview.chapterList.incomplete) {
				debug(`Complete volumes chapters ${JSON.stringify(overview.chapterList.volumeChapterCount)}`);
				title.volumeChapterCount = overview.chapterList.volumeChapterCount;
				title.volumeResetChapter = true;
			}
			// If we don't we need to fetch the chapter list from the API sadly
			// Only fetch if there is a new chapter since last title visit, last read, or if it's the first time
			else if (!title.volumeResetChapter) {
				const currentPage = document.querySelector<HTMLElement>('nav > ul.pagination > .page-item.active');
				const lastChapter = overview.chapterList.rows[overview.chapterList.rows.length - 1];
				let doUpdate = !title.lastTitle || Date.now() - title.lastTitle > 2 * 24 * 60 * 60 * 1000;
				// If we are on page 1 and there is a chapter, check if it was published sooner than last time
				if ((!currentPage || currentPage.textContent == '1') && lastChapter) {
					const lastChapterOut = parseInt(lastChapter.node.dataset.timestamp!) * 1000;
					doUpdate = !title.lastTitle || lastChapterOut > title.lastTitle;
				}
				if (doUpdate) {
					SimpleNotification.info({ text: 'Updating volumes from API...' });
					const response = await this.getMdTitle(id);
					if (response.ok) {
						const uniqueChapters: { [key: number]: number[] } = {};
						const volumeChapterCount: { [key: number]: number } = {};
						for (const mdChapter of response.body.data.chapters) {
							if (!mdChapter.volume) continue;
							const volume = parseInt(mdChapter.volume);
							const chapter = parseFloat(mdChapter.chapter);
							if (uniqueChapters[volume] === undefined || uniqueChapters[volume].indexOf(chapter) < 0) {
								if (Math.floor(chapter) == chapter && chapter > 0) {
									if (!volumeChapterCount[volume]) volumeChapterCount[volume] = 1;
									else volumeChapterCount[volume]++;
								}
								if (!uniqueChapters[volume]) uniqueChapters[volume] = [chapter];
								else uniqueChapters[volume].push(chapter);
							}
						}
						title.volumeChapterCount = volumeChapterCount;
						title.volumeResetChapter = true;
					} else SimpleNotification.error({ text: 'MangaDex API Error.\nVolume chapters not updated.' });
				}
			}
			overview.chapterList.update(title);
		}
		if (!title.volumeResetChapter && !isNaN(max.chapter)) {
			title.max = max;
		}
		title.lastTitle = Date.now();
		await title.persist(); // Always save

		// Load each Services to Sync
		const syncModule = new SyncModule('title', title, overview);
		// Find MangaDex login status
		syncModule.loggedIn = !document.querySelector('button[title="You need to log in to use this function."]');
		syncModule.overview!.syncedLocal(syncModule.title);
		syncModule.initialize();
		// Get MangaDex Status
		const statusButton = document.querySelector('.manga_follow_button.disabled');
		if (statusButton) syncModule.mdState.status = parseInt(statusButton.id.trim());
		// Get MangaDex Score
		const scoreButton = document.querySelector('.manga_rating_button.disabled');
		if (scoreButton) syncModule.mdState.score = parseInt(scoreButton.id.trim()) * 10;
		const imported = await syncModule.syncLocal();
		// Get MangaDex Progress -- defaults to 0
		syncModule.mdState.progress.chapter = parseInt(overview.mdProgress.currentChapter.textContent!);
		syncModule.mdState.progress.volume = parseInt(overview.mdProgress.currentVolume.textContent!);

		// Add all chapters from the ChapterList if it's a new Title
		// Update lastChapter for the History if title was synced
		if (imported && (Options.saveOpenedChapters || Options.biggerHistory)) {
			if (Options.saveOpenedChapters) {
				title.updateChapterList(title.chapter);
			}
			for (const row of overview.chapterList.rows) {
				if (Options.biggerHistory && row.progress.chapter == title.chapter) {
					title.lastChapter = row.chapterId;
					if (!Options.saveOpenedChapters) break;
				}
				if (Options.saveOpenedChapters && row.progress.chapter < title.chapter) {
					title.addChapter(row.progress.chapter);
				}
			}
			// Highlight again if the chapter list needs update
			overview.chapterList.highlight(title);
		}

		// Save added previous opened chapters and highest chapter
		const highest = overview.chapterList.highest;
		if (Options.biggerHistory && (!title.highest || title.highest < highest)) {
			title.highest = highest;
		}
		if (imported || Options.biggerHistory) await title.persist();

		// When the Title is synced, all remaining ServiceTitle are synced with it
		if (title.status != Status.NONE) await syncModule.syncExternal(true);
	}
}

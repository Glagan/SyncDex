import { AppendableElement, DOM } from '../../Core/DOM';
import { listen } from '../../Core/Event';
import { Extension } from '../../Core/Extension';
import { debug, LogExecTime, TryCatch } from '../../Core/Log';
import { MangaDex } from '../../Core/MangaDex';
import { Mochi } from '../../Core/Mochi';
import { Options } from '../../Core/Options';
import { Request } from '../../Core/Request';
import { SyncModule } from '../../Core/SyncModule';
import { iconToService, LocalTitle, MissableField, StatusMap, Title } from '../../Core/Title';
import { TitleEditor } from '../../Core/TitleEditor';
import { dateCompare, dateFormat, isDate } from '../../Core/Utility';
import { Services } from '../../Service/Class/Map';
import { ActivableKey, ServiceKey, OverviewKey } from '../../Service/Keys';
import { ChapterRow } from '../ChapterRow';
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

class QuickButtons {
	node: HTMLElement;
	edit: HTMLButtonElement;
	start: HTMLButtonElement;
	planToRead: HTMLButtonElement;
	hasCompleted: boolean = false;
	completed: HTMLButtonElement;

	constructor() {
		this.edit = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('edit'), DOM.space(), DOM.text('Edit')],
		});
		this.node = DOM.create('div', { class: 'quick-buttons hidden' });
		this.start = DOM.create('button', {
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
		DOM.append(this.node, this.start, DOM.space(), this.planToRead);
	}

	bind(syncModule: SyncModule): void {
		this.edit.addEventListener('click', async (event) => {
			event.preventDefault();
			TitleEditor.create(syncModule, async (updatedIDs) => {
				// Update all overviews if external services IDs were updated
				debug(`Updated IDs after Title Editor ? ${updatedIDs}`);
				if (updatedIDs) {
					// TODO: Update all interface after Title Editor
					/*syncModule.overview.reset();
					for (const serviceKey of Options.services) {
						const key = syncModule.title.services[serviceKey];
						syncModule.overview.initializeService(serviceKey, key != undefined);
						syncModule.overview.receivedInitialRequest(
							serviceKey,
							syncModule.services[serviceKey]!,
							syncModule
						);
					}*/
				}
			}).show();
		});
		const quickBind = async (event: Event, status: Status): Promise<void> => {
			event.preventDefault();
			await syncModule.syncStatus(status);
		};
		this.start.addEventListener('click', (event) => quickBind(event, Status.READING));
		this.planToRead.addEventListener('click', (event) => quickBind(event, Status.PLAN_TO_READ));
		this.completed.addEventListener('click', (event) => quickBind(event, Status.COMPLETED));
	}

	display() {
		this.node.classList.remove('hidden');
	}

	hide() {
		this.node.classList.add('hidden');
	}

	toggle(status: Status) {
		if (status == Status.NONE) {
			this.display();
		} else this.hide();
	}

	addCompletedButton(): void {
		if (!this.hasCompleted) {
			DOM.append(this.node, DOM.space(), this.completed);
			this.hasCompleted = true;
		}
	}

	removeCompletedButton(): void {
		if (this.hasCompleted) {
			this.node.removeChild(this.completed);
			this.node.removeChild(this.node.lastChild!); // Space
			this.hasCompleted = false;
		}
	}
}

class Overview {
	key: OverviewKey;
	node: HTMLElement;
	header: HTMLElement;
	manage: HTMLElement;
	body: HTMLElement;
	refreshButton: HTMLButtonElement;
	syncButton: HTMLButtonElement;
	icon: HTMLElement;
	overlay: HTMLElement;

	static readonly missingFieldsMap: { [key in MissableField]: string } = {
		volume: 'Volume',
		start: 'Start Date',
		end: 'Finish Date',
		score: 'Score',
	};

	constructor(key: OverviewKey) {
		this.key = key;
		this.icon = DOM.create('i', { class: 'fas hidden' });
		this.refreshButton = DOM.create('button', {
			class: 'btn btn-xs btn-secondary',
			childs: [DOM.icon('download'), DOM.space(), DOM.text('Refresh')],
		});
		this.syncButton = DOM.create('button', {
			class: 'btn btn-xs btn-primary sync-button',
			childs: [DOM.icon('sync-alt'), DOM.space(), DOM.text('Sync')],
		});
		this.manage = DOM.create('div', { class: 'manage', childs: [this.refreshButton] });
		this.header = DOM.create('div', {
			class: 'header',
			childs: [
				DOM.create('div', {
					class: 'informations',
					childs: [
						DOM.create('img', { src: Extension.icon(key) }),
						DOM.space(),
						key == ServiceKey.SyncDex ? DOM.text('SyncDex') : Services[key].createTitle(),
						DOM.space(),
						this.icon,
					],
				}),
				this.manage,
			],
		});
		if (this.key != ServiceKey.SyncDex) {
			this.manage.appendChild(this.syncButton);
		}
		this.overlay = DOM.create('div', {
			class: 'overlay hidden',
			childs: [DOM.icon('sync-alt fa-spin'), DOM.space(), DOM.text('Syncing...')],
		});
		this.body = DOM.create('div', { class: 'body', textContent: 'Loading...', childs: [this.overlay] });
		this.node = DOM.create('div', {
			class: `overview ${key}`,
			childs: [this.header, this.body],
		});
		if (Options.services[0] == key) {
			this.node.classList.add('main');
		}
	}

	bind(syncModule: SyncModule) {
		this.refreshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (!this.syncButton.classList.contains('loading')) {
				this.syncButton.classList.add('loading');
				this.syncing();
				await Options.load();
				if (this.key == ServiceKey.SyncDex) {
					await syncModule.refresh();
				} else {
					await syncModule.refreshService(this.key);
				}
				this.syncButton.classList.remove('loading');
			}
		});
		this.syncButton.addEventListener('click', async (event) => {
			event.preventDefault();
			if (this.key !== ServiceKey.SyncDex && !this.syncButton.classList.contains('loading')) {
				this.syncButton.classList.add('loading');
				await syncModule.serviceImport(this.key);
				this.syncButton.classList.remove('loading');
			}
		});
	}

	row<K = Date | number | string>(icon: string, name: string, content?: K, original?: K): HTMLElement {
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
	}

	/**
	 * Create a list of all values for the Media.
	 */
	update(title: Title | RequestStatus | boolean, original: LocalTitle | undefined) {
		this.clear();

		if (typeof title === 'object') {
			if (!title.loggedIn) {
				this.body.appendChild(
					DOM.create('div', {
						class: 'alert alert-danger',
						textContent: 'You are not Logged In.',
					})
				);
				this.setIcon('times has-error');
				return;
			} else if (title.inList && title.status != Status.NONE) {
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
				rows.push(this.row('bookmark', 'Chapter', title.chapter, original?.chapter));
				if (missingFields.indexOf('volume') < 0) {
					if (title.volume) {
						rows.push(this.row('book', 'Volume', title.volume, original?.volume));
					} else {
						rows.push(this.row('book', 'No Volume', undefined, original?.volume));
					}
				}
				if (title.start) {
					rows.push(this.row('calendar-plus', 'Started', title.start, original?.start));
				} else if (missingFields.indexOf('start') < 0) {
					rows.push(this.row('calendar-plus', 'No Start Date', undefined, original?.start));
				}
				if (title.end) {
					rows.push(this.row('calendar-check', 'Completed', title.end, original?.end));
				} else if (missingFields.indexOf('end') < 0) {
					rows.push(this.row('calendar-check', 'No Completion Date', undefined, original?.end));
				}
				if (title.score) {
					rows.push(
						this.row(
							'star',
							'Scored',
							`${title.score} out of 100`,
							original && original.score > 0 ? `${original.score} out of 100` : undefined
						)
					);
				} else if (missingFields.indexOf('score') < 0) {
					rows.push(
						this.row(
							'star',
							'Not Scored yet',
							undefined,
							original && original.score > 0 ? `${original.score} out of 100` : undefined
						)
					);
				}
				for (const missingField of missingFields) {
					rows.push(this.row('ban', `No ${Overview.missingFieldsMap[missingField]} available.`));
				}
				DOM.append(this.body, ...rows);
			} else {
				DOM.append(this.body, DOM.text('Not in List.'));
				this.setIcon('bookmark has-error');
			}

			// Display *Sync* button only if the title is out of sync, with auto sync disabled and if the title is in a list
			if (!Options.autoSync && !title.isSyncedWith(title) && title.status !== Status.NONE && title.loggedIn) {
				this.setIcon('sync has-error');
				// TODO: Display SYNC button
				// this.syncButton.appendChild(this.syncButton);
			}
		} else if (typeof title === 'number') {
			this.setIcon('times has-error');
			this.setErrorMessage(title);
		} else {
			this.body.appendChild(
				this.alert(
					'info',
					`No ID for ${Services[this.key as ActivableKey].name}, you can manually add one in the Save Editor.`
				)
			);
			this.setIcon('times has-error');
		}
	}

	setIcon(icon?: string) {
		if (!icon) {
			this.icon.classList.add('hidden');
		} else {
			this.icon.className = `fas fa-${icon}`;
			this.icon.classList.remove('hidden');
		}
	}

	alert(type: 'warning' | 'danger' | 'info', content: string | AppendableElement[]): HTMLElement {
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
	}

	setErrorMessage(res: RequestStatus) {
		switch (res) {
			case RequestStatus.MISSING_TOKEN:
				this.body.appendChild(
					this.alert('danger', [
						DOM.text('Missing Token, check your Login Status in the Options.'),
						DOM.space(),
						DOM.create('button', {
							class: 'btn btn-primary',
							textContent: 'Open Options',
							events: {
								click: (event) => {
									event.preventDefault();
									Extension.openOptions();
								},
							},
						}),
					])
				);
				break;
			case RequestStatus.BAD_REQUEST:
				this.body.appendChild(this.alert('danger', 'Bad Request, if this happen again open an issue.'));
				break;
			case RequestStatus.NOT_FOUND:
				this.body.appendChild(
					this.alert('danger', 'The Media was not found on the Service, probably a bad ID.')
				);
				break;
			case RequestStatus.FAIL:
			case RequestStatus.SERVER_ERROR:
				this.body.appendChild(this.alert('danger', 'Server Error, the Service might be down, retry later.'));
				break;
		}
	}

	activate() {
		this.node.classList.add('active');
	}

	disable() {
		this.node.classList.remove('active');
	}

	clear() {
		DOM.clear(this.body);
		this.body.appendChild(this.overlay);
		this.overlay.classList.add('hidden');
		this.setIcon();
	}

	syncing() {
		this.setIcon('sync-alt fa-spin');
		this.overlay.classList.remove('hidden');
	}

	synced(): void {
		this.overlay.classList.add('hidden');
	}
}

class Overviews {
	row: HTMLElement;
	column: HTMLElement;
	current!: Overview;
	main: Overview;
	overviews: Partial<{ [key in ActivableKey]: Overview }> = {};
	buttons: QuickButtons;

	constructor() {
		this.column = DOM.create('div', { class: 'overviews col-lg-9 col-xl-10' });
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
		this.buttons = new QuickButtons();

		// Always create SyncDex Overview
		this.main = new Overview(ServiceKey.SyncDex);
		this.bindOverview(this.main);
		this.reset();
	}

	bind(syncModule: SyncModule): void {
		this.buttons.bind(syncModule);
		this.main.bind(syncModule);
		for (const key in this.overviews) {
			this.overviews[key as ActivableKey]!.bind(syncModule);
		}
	}

	reset() {
		DOM.clear(this.column);
		this.column.appendChild(this.main.node);
		this.main.activate();
		this.current = this.main;
		for (const key of Options.services) {
			this.createOverview(key);
		}
		this.column.appendChild(this.buttons.node);
	}

	hasNoServices(syncModule: SyncModule): void {
		const alert = DOM.create('div', {
			class: 'alert alert-warning',
			childs: [
				DOM.text(`You have no active Services, SyncDex won't sync anything until you activate one.`),
				DOM.space(),
				DOM.create('button', {
					class: 'btn btn-secondary',
					childs: [DOM.icon('sync-alt'), DOM.space(), DOM.text('Refresh')],
					events: {
						click: async (event) => {
							event.preventDefault();
							await syncModule.refresh();
						},
					},
				}),
				DOM.icon('edit'),
				DOM.space(),
			],
		});
		alert.style.marginTop = '8px';
		this.column.appendChild(alert);
	}

	createOverview(key: ActivableKey): Overview {
		// Remove Previous if there is one
		if (this.overviews[key] !== undefined) {
			this.overviews[key]!.node.remove();
			delete this.overviews[key];
		}
		// Create the new Overview
		const overview = new Overview(key);
		this.column.appendChild(overview.node);
		this.bindOverview(overview);
		this.overviews[key] = overview;
		return overview;
	}

	bindOverview(overview: Overview): void {
		overview.header.addEventListener('click', (event) => {
			event.preventDefault();
			if (this.current) {
				this.current.disable();
			}
			this.current = overview;
			this.current.activate();
		});
	}

	syncing(key: ActivableKey) {
		const overview = this.overviews[key];
		if (overview) overview.syncing();
	}

	synced(key: ActivableKey, title: Title | RequestStatus | boolean, local: LocalTitle) {
		const overview = this.overviews[key];
		if (overview) {
			overview.update(title, local); // TODO: Boolean no ID
			overview.synced();
		}
	}
}

class ChapterList {
	highest: number = 0;
	rows: ChapterRow[] = [];
	languageMap: { [key: string]: string } = {};
	rowLanguages: { code: string; node: HTMLElement }[] = [];
	volumeResetChapter: boolean;
	volumeChapterCount: { [key: number]: number };
	volumeChapterOffset: { [key: number]: number };
	// Flag if there is more than one page if Volume reset chapters
	incomplete: boolean;

	/**
	 * Find each rows, their previous/next and add CSS for animations
	 */
	constructor() {
		const chapterRows = Array.from(document.querySelectorAll<HTMLElement>('.chapter-row')).reverse();
		let lastVolume: number = 0;
		this.volumeResetChapter = false;
		let uniqueChapters: number[] = [];
		this.volumeChapterCount = {};
		this.volumeChapterOffset = {};
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
							if (chapterRow.progress.chapter == 1) {
								this.volumeChapterOffset[currentVolume] = 1;
							}
						} else if (currentVolume > 1) lastVolume = -1;
						uniqueChapters = [];
					}
					// Avoid adding sub chapters and duplicates
					if (
						uniqueChapters.indexOf(chapterRow.progress.chapter) < 0 &&
						chapterRow.progress.chapter >= 1 &&
						Math.floor(chapterRow.progress.chapter) == chapterRow.progress.chapter
					) {
						if (this.volumeChapterCount[currentVolume]) {
							this.volumeChapterCount[currentVolume]++;
						} else this.volumeChapterCount[currentVolume] = 1;
						uniqueChapters.push(chapterRow.progress.chapter);
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
						row.progress.chapter += 0.5;
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
							// Remove background color if it's not next nor current
							if (!otherRow.isNext && row.progress.chapter != title.progress.chapter) {
								otherRow.node.style.backgroundColor = '';
							}
							// Still disable toggle button
							otherRow.disableToggleButton();
						}
					}
				} else {
					title.addChapter(row.progress.chapter);
					// Toggle all rows with the same chapter value
					for (const otherRow of this.rows) {
						if (otherRow.progress.chapter == row.progress.chapter) {
							if (!otherRow.isNext && row.progress.chapter != title.progress.chapter) {
								otherRow.node.style.backgroundColor = Options.colors.openedChapter;
							}
							otherRow.enableToggleButton();
						}
					}
				}
				await title.persist();
			});

			// Bind Set as Latest button
			row.markButton.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.progress.chapter == title.chapter) return;

				if (row.markButton.classList.contains('loading')) return;
				row.markButton.classList.add('loading');

				// Update to current row progress
				await syncModule.syncProgress(row.progress);

				// Always update History
				if (Options.biggerHistory) {
					await title.setHistory(row.chapterId);
					await title.persist();
				}

				row.markButton.classList.remove('loading');
			});
		}
		this.highlight(title);

		// Create and append Language Button
		const navTabs = document.querySelector<HTMLElement>('ul.edit.nav.nav-tabs');
		ChapterRow.generateLanguageButtons(navTabs);
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

class MangaDexList {
	status?: {
		followButton: HTMLButtonElement;
		button: HTMLButtonElement;
		dropdown: HTMLElement;
		unfollow: HTMLAnchorElement;
		list: HTMLAnchorElement[];
	};
	score: {
		button: HTMLButtonElement;
		dropdown: HTMLElement;
		ratings: HTMLAnchorElement[];
	};
	progress: {
		currentVolume: HTMLElement;
		incVolume: HTMLButtonElement;
		inputVolume: HTMLInputElement;
		currentChapter: HTMLElement;
		incChapter: HTMLButtonElement;
		inputChapter: HTMLInputElement;
	};

	static statusDescription: Partial<{ [key in Status]: [string, string] }> = {
		[Status.READING]: ['eye', 'success'],
		[Status.COMPLETED]: ['check', 'primary'],
		[Status.PAUSED]: ['pause', 'warning'],
		[Status.PLAN_TO_READ]: ['calendar-alt', 'info'],
		[Status.DROPPED]: ['trash', 'danger'],
		[Status.REREADING]: ['eye', 'secondary'],
	};

	constructor() {
		const statusButtons = document.querySelectorAll<HTMLAnchorElement>('a.manga_follow_button');
		if (statusButtons.length > 0) {
			this.status = {
				followButton: DOM.create('button'),
				button: statusButtons[0].parentElement!.previousElementSibling as HTMLButtonElement,
				dropdown: statusButtons[0].parentElement!,
				unfollow: DOM.create('a'),
				list: Array.from(statusButtons),
			};
			// Replace old node to remove all events
			for (const idx in this.status.list) {
				const oldStatus = this.status.list[idx];
				const status = oldStatus.cloneNode(true) as HTMLAnchorElement;
				oldStatus.replaceWith(status);
				this.status.list[idx] = status;
			}
			// Create Follow button if it doesn't exist
			const followButton = document.querySelector<HTMLButtonElement>('button.manga_follow_button');
			if (followButton) {
				const newFollow = followButton.cloneNode(true) as HTMLButtonElement;
				followButton.replaceWith(newFollow);
				this.status.followButton = newFollow;
			} else {
				this.status.followButton.className = 'btn btn-secondary';
				DOM.append(
					this.status.followButton,
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
				this.status.unfollow = newUnfollow;
			} else {
				this.status.unfollow.className = 'dropdown-item';
				this.status.unfollow.href = '#';
				DOM.append(this.status.unfollow, DOM.icon('bookmark fa-fw'), DOM.text('Unfollow'));
			}
		}

		// Update Score selector
		const ratingButtons = document.querySelectorAll<HTMLAnchorElement>('a.manga_rating_button');
		this.score = {
			button: ratingButtons[0].parentElement!.previousElementSibling as HTMLButtonElement,
			dropdown: ratingButtons[0].parentElement!,
			ratings: [],
		};
		// Replace old node to remove all events
		for (const oldRating of ratingButtons) {
			const rating = oldRating.cloneNode(true) as HTMLAnchorElement;
			oldRating.replaceWith(rating);
			this.score.ratings.unshift(rating);
		}

		// Find MangaDex Progress nodes
		const editProgressForm = document.getElementById('edit_progress_form') as HTMLFormElement;
		const incVolume = document.getElementById('increment_volume') as HTMLButtonElement;
		const incChapter = document.getElementById('increment_chapter') as HTMLButtonElement;
		this.progress = {
			currentVolume: document.getElementById('current_volume') as HTMLElement,
			incVolume: incVolume.cloneNode(true) as HTMLButtonElement,
			inputVolume: editProgressForm.querySelector('#volume') as HTMLInputElement,
			currentChapter: document.getElementById('current_chapter') as HTMLElement,
			incChapter: incChapter.cloneNode(true) as HTMLButtonElement,
			inputChapter: editProgressForm.querySelector('#chapter') as HTMLInputElement,
		};
		// Replace increment buttons
		incVolume.replaceWith(this.progress.incVolume);
		incChapter.replaceWith(this.progress.incChapter);
	}

	async bindStatusUpdate(event: Event, syncModule: SyncModule, status: Status): Promise<void> {
		event.preventDefault();
		if (syncModule.mdState.status == status) return;
		if (Options.mdUpdateSyncDex) {
			await syncModule.syncStatus(status);
		}
		if (!Options.mdUpdateSyncDex || !Options.updateMD) {
			await syncModule.syncMangaDexStatus(status);
		}
	}

	bind(syncModule: SyncModule): void {
		// Replace Status
		if (this.status) {
			this.status.followButton.addEventListener('click', (event) => {
				this.bindStatusUpdate(event, syncModule, Status.READING);
			});
			this.status.unfollow.addEventListener('click', (event) => {
				if (confirm('This will remove all Read chapters from MangaDex (the eye icon).\nAre you sure ?')) {
					this.bindStatusUpdate(event, syncModule, Status.NONE);
				}
			});
			for (const row of this.status.list) {
				const status = parseInt(row.id);
				row.addEventListener('click', async (event) => {
					if (row.classList.contains('disabled')) return;
					this.bindStatusUpdate(event, syncModule, status);
				});
			}
		}

		// Replace ratings
		for (const row of this.score.ratings) {
			const score = parseInt(row.id) * 10;
			row.addEventListener('click', async (event) => {
				event.preventDefault();
				if (row.classList.contains('disabled')) return;
				if (Options.mdUpdateSyncDex) {
					syncModule.syncScore(score);
				}
				if (!Options.mdUpdateSyncDex || !Options.updateMD) {
					syncModule.syncMangaDexRating(score);
				}
			});
		}

		// Replace Increment buttons
		this.progress.incVolume.addEventListener('click', async (event) => {
			event.preventDefault();
			let volume = 1;
			if (syncModule.mdState.progress.volume) {
				volume = syncModule.mdState.progress.volume++;
			}
			syncModule.syncMangaDexProgress({ chapter: syncModule.mdState.progress.chapter, volume });
		});
		this.progress.incChapter.addEventListener('click', async (event) => {
			event.preventDefault();
			const chapter = syncModule.mdState.progress.chapter++;
			syncModule.syncMangaDexProgress({ chapter, volume: syncModule.mdState.progress.volume });
		});
	}

	disable() {
		this.score.button.disabled = true;
		if (this.status) {
			this.status.button.disabled = true;
		}
		this.progress.incChapter.disabled = true;
		this.progress.inputChapter.disabled = true;
		this.progress.incChapter.disabled = true;
		this.progress.inputVolume.disabled = true;
	}

	enable() {
		this.score.button.disabled = false;
		if (this.status) {
			this.status.button.disabled = false;
		}
		this.progress.incChapter.disabled = false;
		this.progress.inputChapter.disabled = false;
		this.progress.incChapter.disabled = false;
		this.progress.inputVolume.disabled = false;
	}

	update(field: MangaDexTitleField, state: MangaDexState) {
		// Activate new Status or Rating
		// If we're unfollowing, hide Unfollow and revert to default
		if (this.status && field == 'unfollow') {
			const buttonContainer = this.status.dropdown.parentElement!;
			buttonContainer.insertBefore(this.status.followButton, buttonContainer.firstElementChild);
			this.status.button.className = 'btn btn-secondary dropdown-toggle dropdown-toggle-split';
			DOM.clear(this.status.button);
			this.status.button.appendChild(DOM.create('span', { class: 'sr-only', textContent: 'Toggle Dropdown' }));
			this.status.unfollow.remove();
		}
		// Status
		else if (this.status && field == 'status') {
			if (state.status !== Status.NONE) {
				const status = this.status.dropdown.querySelector(`[id='${state.status}']`);
				if (!state.status || !status) return;
				status.classList.add('disabled');
				// Update button style
				const description = MangaDexList.statusDescription[state.status]!;
				DOM.clear(this.status.button);
				DOM.append(
					this.status.button,
					DOM.icon(`${description[0]} fa-fw`),
					DOM.space(),
					DOM.create('span', {
						class: 'd-none d-xl-inline',
						textContent: StatusMap[state.status],
					})
				);
				this.status.button.className = `btn btn-${description[1]} dropdown-toggle`;
				this.status.dropdown.insertBefore(this.status.unfollow, this.status.dropdown.firstElementChild);
				this.status.followButton.remove();
			}
		}
		// Score
		else if (field == 'rating') {
			if (state.rating == 0) {
				this.score.ratings[0].classList.add('disabled');
				this.score.button.childNodes[1].textContent = ` `;
			} else {
				const newScore = state.rating < 10 ? 1 : Math.round(state.rating / 10);
				this.score.ratings[newScore].classList.add('disabled');
				this.score.button.childNodes[1].textContent = ` ${newScore} `;
			}
		}
		// Progress
		else if (field == 'progress') {
			this.progress.currentChapter.textContent = `${state.progress.chapter}`;
			this.progress.inputChapter.value = `${state.progress.chapter}`;
			this.progress.currentVolume.textContent = `${state.progress.volume}`;
			this.progress.inputVolume.value = `${state.progress.volume}`;
		}
	}
}

export class TitlePage extends Page {
	@LogExecTime
	getMdTitle(id: number): Promise<JSONResponse<MangaDexTitleWithChaptersResponse>> {
		return Request.json<MangaDexTitleWithChaptersResponse>({
			method: 'GET',
			url: MangaDex.api('get:title', id, { chapters: true }),
			credentials: 'include',
		});
	}

	@TryCatch(Page.errorNotification)
	async run() {
		console.log('SyncDex :: Title');

		// Interface
		const chapterList = new ChapterList();
		const mangaDexList = new MangaDexList();
		const overviews = new Overviews();

		// Get Title
		const id = parseInt(document.querySelector<HTMLElement>('.row .fas.fa-hashtag')!.parentElement!.textContent!);
		const title = await LocalTitle.get(id);
		overviews.main.update(title, undefined); // Update early to take space
		const syncModule = new SyncModule('title', title);
		syncModule.loggedIn = !document.querySelector('button[title="You need to log in to use this function."]');
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

			// Add Links
			const serviceList = informationRow.querySelector('ul')!;
			for (const key of Object.values(ActivableKey)) {
				const localService = localServices[key];
				if (title.services[key] == undefined) continue;
				const serviceName = Services[key].name;
				// If there is no localService add a link
				if (localService == undefined) {
					const link = DOM.create('li', {
						class: 'list-inline-item',
						childs: [
							DOM.create('img', { src: Extension.icon(key), title: serviceName }),
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

		// Update offset and displayed chapters if volume reset chapter
		if (chapterList.volumeResetChapter || title.volumeResetChapter) {
			// If we have all available chapters, we can update the volumeChapterCount of the title
			if (!chapterList.incomplete) {
				title.volumeChapterCount = chapterList.volumeChapterCount;
				title.volumeChapterOffset = chapterList.volumeChapterOffset;
				title.volumeResetChapter = true;
			}
			// If we don't we need to fetch the chapter list from the API sadly
			// Only fetch if there is a new chapter since last title visit, last read, or if it's the first time
			else if (!title.volumeResetChapter) {
				const currentPage = document.querySelector<HTMLElement>('nav > ul.pagination > .page-item.active');
				const lastChapter = chapterList.rows[chapterList.rows.length - 1];
				let doUpdate = !title.lastTitle || Date.now() - title.lastTitle > 2 * 24 * 60 * 60 * 1000;
				// If we are on page 1 and there is a chapter, check if it was published sooner than last time
				if ((!currentPage || currentPage.textContent == '1') && lastChapter) {
					const lastChapterOut = parseInt(lastChapter.node.dataset.timestamp!) * 1000;
					doUpdate = !title.lastTitle || lastChapterOut > title.lastTitle;
				}
				if (doUpdate) {
					SimpleNotification.info(
						{ text: 'Updating volumes from API...' },
						{ duration: Options.infoDuration }
					);
					const response = await this.getMdTitle(id);
					if (response.ok) {
						let uniqueChapters: number[] = [];
						const volumeChapterCount: { [key: number]: number } = {};
						const volumeChapterOffset: { [key: number]: number } = {};
						let lastVolume = 0;
						for (const mdChapter of response.body.data.chapters) {
							if (!mdChapter.volume) continue;
							const volume = parseInt(mdChapter.volume);
							const chapter = parseFloat(mdChapter.chapter);
							if (volume != lastVolume && chapter == 1) {
								volumeChapterOffset[volume] = 1;
								lastVolume = volume;
								uniqueChapters = [];
							}
							if (uniqueChapters.indexOf(chapter) < 0) {
								if (Math.floor(chapter) == chapter && chapter > 0) {
									if (!volumeChapterCount[volume]) volumeChapterCount[volume] = 1;
									else volumeChapterCount[volume]++;
								}
								uniqueChapters.push(chapter);
							}
						}
						title.volumeChapterCount = volumeChapterCount;
						title.volumeChapterOffset = volumeChapterOffset;
						title.volumeResetChapter = true;
					} else
						SimpleNotification.error(
							{ text: 'MangaDex API Error.\nVolume chapters not updated.' },
							{ duration: Options.errorDuration }
						);
				}
			}
			chapterList.update(title);
		}
		if (!title.volumeResetChapter && !isNaN(max.chapter)) {
			title.max = max;
		}
		title.lastTitle = Date.now();
		await title.persist(); // Always save

		// Bind interfaces
		chapterList.bind(syncModule);
		mangaDexList.bind(syncModule);
		overviews.bind(syncModule);
		if (Options.services.length == 0) {
			overviews.hasNoServices(syncModule);
		}

		// Add listeners
		listen('title:syncing', () => overviews.main.syncing());
		listen('title:synced', (payload) => {
			overviews.main.update(payload.title, undefined);
			overviews.main.synced();
		});
		listen('title:refresh', () => {
			overviews.reset();
			overviews.bind(syncModule);
		});
		listen('mangadex:syncing', () => mangaDexList.disable());
		listen('mangadex:synced', (payload) => {
			mangaDexList.update(payload.field, payload.state);
			mangaDexList.enable();
		});
		listen('sync:initialize:start', () => overviews.main.syncing());
		listen('service:syncing', (payload) => overviews.syncing(payload.key));
		listen('service:synced', (payload) => overviews.synced(payload.key, payload.title, payload.local));
		listen('sync:initialize:end', (payload) => {
			const { title } = payload;
			if (title.status == Status.NONE) {
				overviews.buttons.display();
			} else overviews.buttons.hide();
			// Add the *Completed* button only if the title is complete
			if (title.max && title.max.chapter) {
				overviews.buttons.addCompletedButton();
			}
			overviews.main.synced();
		});
		listen('sync:start', () => {
			overviews.main.syncing();
			overviews.buttons.hide();
			mangaDexList.disable();
		});
		listen('sync:end', (payload) => {
			overviews.buttons.toggle(payload.syncModule.title.status);
			overviews.main.update(payload.syncModule.title, undefined);
			overviews.main.synced();
			chapterList.highlight(payload.syncModule.title);
			mangaDexList.enable();
		});

		// Start syncModule work
		syncModule.initialize();
		// Get MangaDex Status
		const statusButton = document.querySelector('.manga_follow_button.disabled');
		if (statusButton) syncModule.mdState.status = parseInt(statusButton.id.trim());
		// Get MangaDex Score
		const scoreButton = document.querySelector('.manga_rating_button.disabled');
		if (scoreButton) syncModule.mdState.rating = parseInt(scoreButton.id.trim()) * 10;
		const imported = await syncModule.syncLocal();
		// Get MangaDex Progress -- defaults to 0
		syncModule.mdState.progress.chapter = parseFloat(mangaDexList.progress.currentChapter.textContent!);
		syncModule.mdState.progress.volume = parseInt(mangaDexList.progress.currentVolume.textContent!);

		// Add all chapters from the ChapterList if it's a new Title
		// Update lastChapter for the History if title was synced
		if (imported && (Options.saveOpenedChapters || Options.biggerHistory)) {
			if (Options.saveOpenedChapters) {
				title.updateChapterList(title.chapter);
			}
			for (const row of chapterList.rows) {
				if (Options.biggerHistory && row.progress.chapter == title.chapter) {
					title.lastChapter = row.chapterId;
					if (!Options.saveOpenedChapters) break;
				}
				if (Options.saveOpenedChapters && row.progress.chapter < title.chapter) {
					title.addChapter(row.progress.chapter);
				}
			}
			// Highlight again if the chapter list needs update
			chapterList.highlight(title);
		}

		// Save added previous opened chapters and highest chapter
		const highest = chapterList.highest;
		if (Options.biggerHistory && (!title.highest || title.highest < highest)) {
			title.highest = highest;
		}
		if (imported || Options.biggerHistory) await title.persist();

		// When the Title is synced, all remaining ServiceTitle are synced with it
		if (title.status != Status.NONE) await syncModule.syncExternal(true);
	}
}

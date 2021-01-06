import { DOM, AppendableElement } from '../Core/DOM';
import { LocalTitle, Title, StatusMap, MissableField, ExternalTitle } from '../Core/Title';
import { Runtime } from '../Core/Runtime';
import { Options } from '../Core/Options';
import { SyncModule } from '../Core/SyncModule';
import { TitleEditor } from '../Core/TitleEditor';
import { ChapterList } from './ChapterList';
import { ChapterRow } from './ChapterRow';
import { dateCompare, dateFormat, isDate } from '../Core/Utility';
import { Services } from '../Service/Class/Map';
import { ActivableKey, ServiceKey, StaticKey } from '../Service/Keys';

export abstract class Overview {
	bind?(syncModule: SyncModule): void;
	abstract reset(): void;
	abstract hasNoServices(): void;
	abstract initializeService(key: ActivableKey, hasId: boolean): void;
	abstract receivedInitialRequest(key: ActivableKey, res: Title | RequestStatus, syncModule: SyncModule): void;
	receivedAllInitialRequests?(syncModule: SyncModule): void;
	abstract syncingService(key: ServiceKey): void;
	abstract syncedService(key: ServiceKey, res: Title | RequestStatus, title: LocalTitle): void;
	abstract syncingLocal(): void;
	abstract syncedLocal(title: LocalTitle): void;
	syncedMangaDex?(type: 'unfollow' | 'status' | 'score', syncModule: SyncModule): void;
}

type OverviewKey = ActivableKey | StaticKey.SyncDex;

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
	overview = (title: Title, parent: HTMLElement): void => {
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
			const missingFields = (<typeof Title>title.constructor).missingFields;
			const rows: HTMLElement[] = [
				DOM.create('div', { class: `status st${title.status}`, textContent: StatusMap[title.status] }),
			];
			rows.push(this.overviewRow('bookmark', 'Chapter', title.progress.chapter, title?.progress.chapter));
			if (missingFields.indexOf('volume') < 0 && title.progress.volume) {
				rows.push(this.overviewRow('book', 'Volume', title.progress.volume, title?.progress.volume));
			}
			if (title.start) {
				rows.push(this.overviewRow('calendar-plus', 'Started', title.start, title?.start));
			} else if (missingFields.indexOf('start') < 0) {
				rows.push(this.overviewRow('calendar-plus', 'No Start Date', undefined, title?.start));
			}
			if (title.end) {
				rows.push(this.overviewRow('calendar-check', 'Completed', title.end, title?.end));
			} else if (missingFields.indexOf('end') < 0) {
				rows.push(this.overviewRow('calendar-check', 'No Completion Date', undefined, title?.end));
			}
			if (title.score) {
				rows.push(
					this.overviewRow(
						'star',
						'Scored',
						`${title.score} out of 100`,
						title && title.score > 0 ? `${title.score} out of 100` : undefined
					)
				);
			} else if (missingFields.indexOf('score') < 0)
				rows.push(
					this.overviewRow(
						'star',
						'Not Scored yet',
						undefined,
						title && title.score > 0 ? `${title.score} out of 100` : undefined
					)
				);
			for (const missingField of missingFields) {
				rows.push(
					this.overviewRow(
						'ban',
						`No ${ServiceOverview.missingFieldsMap[missingField]} available on ${
							(<typeof ExternalTitle>title.constructor).service.name
						}`
					)
				);
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
			this.overview(res, this.content);
			// Display *Sync* button only if the title is out of sync, with auto sync disabled and if the title is in a list
			if (!Options.autoSync && !res.isSynced(title) && title.status !== Status.NONE && res.loggedIn) {
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
			TitleEditor.create(syncModule, async () => {
				syncModule.overview?.reset();
				// Initialize SyncModule again if there is new Service IDs
				syncModule.initialize();
				await syncModule.syncLocal();
				await syncModule.syncExternal(true);
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
			if (title.progress.chapter > 0) {
				this.overview(title, this.content);
			}
			this.content.appendChild(this.quickButtons);
		} else this.overview(title, this.content);
		this.manage.appendChild(this.editButton);
		this.manage.appendChild(this.refreshButton);
	};
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

		this.chapterList = new ChapterList();
		// Add Language buttons
		const navTabs = document.querySelector<HTMLElement>('ul.edit.nav.nav-tabs');
		ChapterRow.generateLanguageButtons(navTabs);
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

	syncedMangaDex = (type: 'unfollow' | 'status' | 'score', syncModule: SyncModule): void => {
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
		} else {
			const newScore = Math.round(syncModule.mdState.score / 10);
			this.mdScore.ratings[Math.max(0, newScore - 1)].classList.add('disabled');
			this.mdScore.button.childNodes[1].textContent = ` ${newScore} `;
		}
	};
}

export class ReadingOverview {
	rowContainer: HTMLElement;
	serviceRow: HTMLElement;
	icons: Partial<{ [key in ActivableKey]: HTMLImageElement }> = {};
	editButton: HTMLButtonElement;

	constructor() {
		this.editButton = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('edit'), DOM.space(), DOM.text('Edit')],
		});
		this.serviceRow = DOM.create('div', {
			class: 'col row no-gutters reading-overview',
			childs: [this.editButton],
		});
		this.rowContainer = DOM.create('div', {
			class: 'col-auto row no-gutters p-1',
			childs: [this.serviceRow],
		});
		const actionsRow = document.querySelector('.reader-controls-mode')!;
		actionsRow.parentElement!.insertBefore(this.rowContainer, actionsRow);
	}

	reset() {
		DOM.clear(this.rowContainer);
	}

	bind = (syncModule: SyncModule): void => {
		this.editButton.addEventListener('click', async (event) => {
			event.preventDefault();
			TitleEditor.create(syncModule, async () => {
				this.reset();
				syncModule.initialize();
				await syncModule.syncLocal();
				await syncModule.syncExternal(true);
			}).show();
		});
	};

	updateIcon = (icon: HTMLImageElement, res: Title | RequestStatus): void => {
		icon.classList.remove('loading', 'error', 'synced', 'warning');
		if (!Options.iconsSilentAfterSync) {
			if (res instanceof Title) {
				if (!res.loggedIn) {
					icon.classList.add('error');
				} else {
					icon.classList.add('synced');
				}
			} else icon.classList.add('warning');
		}
	};

	hasNoServices = (): void => {
		this.rowContainer.remove();
	};

	initializeService = (key: ActivableKey, hasId: boolean): void => {
		const icon = DOM.create('img', {
			src: Runtime.icon(key),
			title: Services[key].name,
		});
		if (hasId) {
			icon.classList.add('loading');
		} else if (!Options.iconsSilentAfterSync) {
			icon.classList.add('error');
		}
		this.serviceRow.insertBefore(icon, this.serviceRow.lastElementChild);
		this.icons[key] = icon;
	};

	receivedInitialRequest = (key: ActivableKey, res: Title | RequestStatus, syncModule: SyncModule): void => {
		const icon = this.icons[key];
		if (!icon) return;
		this.updateIcon(icon, res);
	};

	syncingService = (key: ActivableKey): void => {
		const icon = this.icons[key];
		if (!icon) return;
		icon.classList.add('loading');
	};

	syncedService = (key: ActivableKey, res: Title | RequestStatus, title: Title): void => {
		const icon = this.icons[key];
		if (!icon) return;
		this.updateIcon(icon, res);
	};

	syncingLocal = (): void => {};
	syncedLocal = (title: Title): void => {};
}

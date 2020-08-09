import { DOM, AppendableElement } from '../Core/DOM';
import { BaseTitle, ActivableKey, ServiceKey, ReverseServiceName, StaticKey, Title } from '../Core/Title';
import { Runtime } from '../Core/Runtime';
import { Options } from '../Core/Options';
import { SyncModule } from './SyncModule';

export abstract class Overview {
	bind?(syncModule: SyncModule): void;
	abstract hasNoServices(): void;
	abstract initializeService(key: ActivableKey, hasId: boolean): void;
	abstract receivedInitialRequest(key: ActivableKey, res: BaseTitle | RequestStatus, syncModule: SyncModule): void;
	abstract syncingService(key: ServiceKey): void;
	abstract syncedService(key: ServiceKey, res: BaseTitle | RequestStatus, title: Title): void;
	abstract syncingLocal(): void;
	abstract syncedLocal(title: Title): void;
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

	constructor(key: OverviewKey) {
		this.key = key;
		this.tab = DOM.create('li', {
			class: `tab ${key}`,
			childs: [DOM.create('img', { src: Runtime.icon(key) }), DOM.space(), DOM.text(ReverseServiceName[key])],
		});
		this.content = DOM.create('div', { class: 'content', textContent: 'Loading...' });
		this.manage = DOM.create('div', { class: 'manage' });
		this.body = DOM.create('div', { class: 'body hidden' });
		DOM.append(this.body, this.content, this.manage);
		if (Options.mainService == key) this.tab.classList.add('main');
		this.refreshButton = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('download'), DOM.space(), DOM.text('Refresh')],
		});
		this.syncButton = DOM.create('button', {
			class: 'btn btn-primary sync-button',
			childs: [DOM.icon('sync-alt'), DOM.space(), DOM.text('Sync')],
		});
	}

	bind = (syncModule: SyncModule): void => {
		this.refreshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			this.syncing();
			await Options.load();
			await syncModule.refreshService(this.key as ActivableKey);
			this.synced();
		});
		this.syncButton.addEventListener('click', async (event) => {
			event.preventDefault();
			this.syncing();
			await syncModule.serviceImport(this.key as ActivableKey);
			this.synced();
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
						this.refreshButton,
						DOM.space(),
						ServiceOverview.openOptionsButton(),
					])
				);
				break;
			case RequestStatus.BAD_REQUEST:
				this.content.appendChild(
					ServiceOverview.alert('danger', [
						DOM.text('Bad Request, if this happen again open an issue.'),
						DOM.space(),
						this.refreshButton,
					])
				);
				break;
			case RequestStatus.NOT_FOUND:
				this.content.appendChild(
					ServiceOverview.alert('danger', 'The Media was not found on the Service, probably a bad ID.')
				);
				break;
			case RequestStatus.SERVER_ERROR:
				this.content.appendChild(
					ServiceOverview.alert('danger', [
						DOM.text('Server Error, the Service might be down, retry later.'),
						DOM.space(),
						this.refreshButton,
					])
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

	update = (res: BaseTitle | RequestStatus, title: Title): void => {
		this.clear();
		if (typeof res === 'object') {
			res.overview(this.content, title);
			this.manage.appendChild(this.refreshButton);
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
	};

	synced = (): void => {
		if (this.tabIcon) {
			this.tabIcon.remove();
			this.tabIcon = undefined;
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

class SyncDexOverview extends ServiceOverview {
	quickButtons: HTMLElement;
	startReading: HTMLButtonElement;
	planToRead: HTMLButtonElement;

	constructor() {
		super(StaticKey.SyncDex);
		this.quickButtons = DOM.create('div', { class: 'quick-buttons' });
		this.startReading = DOM.create('button', {
			class: 'btn btn-primary',
			childs: [DOM.icon('book-open'), DOM.space(), DOM.text('Start Reading')],
		});
		this.planToRead = DOM.create('button', {
			class: 'btn btn-secondary',
			childs: [DOM.icon('bookmark'), DOM.space(), DOM.text('Add to Plan to Read')],
		});
		DOM.append(this.quickButtons, this.startReading, DOM.space(), this.planToRead);
	}

	bind = (syncModule: SyncModule): void => {
		this.refreshButton.addEventListener('click', async (event) => {
			event.preventDefault();
			await syncModule.title.refresh();
			await syncModule.syncLocal();
			await syncModule.syncExternal(true);
		});
		const quickBind = async (event: Event, status: Status): Promise<void> => {
			event.preventDefault();
			syncModule.title.status = status;
			if (status == Status.READING) syncModule.title.start = new Date();
			await syncModule.syncLocal();
			await syncModule.syncExternal(true);
		};
		this.startReading.addEventListener('click', (event) => quickBind(event, Status.READING));
		this.planToRead.addEventListener('click', (event) => quickBind(event, Status.PLAN_TO_READ));
	};

	update = (_res: BaseTitle | RequestStatus, title: Title): void => {
		this.clear();
		if (title.status == Status.NONE) {
			this.content.appendChild(this.quickButtons);
		} else title.overview(this.content);
		this.manage.appendChild(this.refreshButton);
	};
}

export class TitleOverview extends Overview {
	row: HTMLElement;
	column: HTMLElement;
	serviceList: HTMLUListElement;
	bodies: HTMLElement;
	current?: ServiceOverview;
	mainOverview: SyncDexOverview;
	overviews: Partial<{ [key in ActivableKey]: ServiceOverview }> = {};

	constructor() {
		super();
		this.column = DOM.create('div', { class: 'overview col-lg-9 col-xl-10' });
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
		this.mainOverview = new SyncDexOverview();
		this.bindOverview(this.mainOverview);
		this.activateOverview(this.mainOverview);
	}

	bind = (syncModule: SyncModule): void => {
		this.mainOverview.bind(syncModule);
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
		if (Options.overviewMainOnly && key !== Options.mainService) return;
		const overview = this.createOverview(key);
		if (hasId) {
			overview.syncing();
		} else {
			overview.content.textContent = '';
			overview.content.appendChild(
				ServiceOverview.alert(
					'info',
					`No ID for ${ReverseServiceName[key]}, you can manually add one in the Save Editor.`
				)
			);
			overview.setTabIcon('times has-error');
		}
	};

	receivedInitialRequest = (key: ActivableKey, res: BaseTitle | RequestStatus, syncModule: SyncModule): void => {
		const overview = this.overviews[key];
		if (overview) {
			overview.bind(syncModule);
			overview.update(res, syncModule.title);
		}
	};

	syncingService = (key: ActivableKey): void => {
		const overview = this.overviews[key];
		if (overview) overview.syncing();
	};

	syncedService = (key: ActivableKey, res: BaseTitle | RequestStatus, title: Title): void => {
		const overview = this.overviews[key];
		if (!overview) return;
		overview.synced();
		overview.update(res, title);
	};

	syncingLocal = (): void => {
		this.mainOverview.syncing();
	};

	syncedLocal = (title: Title): void => {
		this.mainOverview.update(RequestStatus.SUCCESS, title);
		this.mainOverview.synced();
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
}

export class ReadingOverview {
	rowContainer: HTMLElement;
	serviceRow: HTMLElement;
	icons: Partial<{ [key in ActivableKey]: HTMLImageElement }> = {};

	constructor() {
		this.serviceRow = DOM.create('div', { class: 'col row no-gutters reading-overview' });
		this.rowContainer = DOM.create('div', {
			class: 'col-auto row no-gutters p-1',
			childs: [this.serviceRow],
		});
		const actionsRow = document.querySelector('.reader-controls-mode')!;
		actionsRow.parentElement!.insertBefore(this.rowContainer, actionsRow);
	}

	updateIcon = (icon: HTMLImageElement, res: BaseTitle | RequestStatus): void => {
		if (res instanceof BaseTitle) {
			if (!res.loggedIn) {
				icon.classList.add('error');
			} else {
				icon.classList.add('synced');
			}
		} else icon.classList.add('warning');
	};

	hasNoServices = (): void => {
		this.rowContainer.remove();
	};

	initializeService = (key: ActivableKey, hasId: boolean): void => {
		const icon = DOM.create('img', {
			class: 'loading',
			src: Runtime.icon(key),
			title: ReverseServiceName[key],
		});
		this.serviceRow.appendChild(icon);
		if (!hasId) icon.classList.add('error');
		this.icons[key] = icon;
	};

	receivedInitialRequest = (key: ActivableKey, res: BaseTitle | RequestStatus, _syncModule: SyncModule): void => {
		const icon = this.icons[key];
		if (!icon) return;
		icon.classList.remove('loading');
		this.updateIcon(icon, res);
	};

	syncingService = (key: ActivableKey): void => {
		const icon = this.icons[key];
		if (!icon) return;
		icon.classList.add('loading');
	};

	syncedService = (key: ActivableKey, res: BaseTitle | RequestStatus, _title: Title): void => {
		const icon = this.icons[key];
		if (!icon) return;
		icon.classList.remove('loading');
		this.updateIcon(icon, res);
	};

	syncingLocal = (): void => {};
	syncedLocal = (_title: Title): void => {};
}

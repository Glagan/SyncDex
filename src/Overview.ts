import { DOM, AppendableElement } from './DOM';
import { Title, ServiceTitle, ActivableKey, ReverseActivableName, ServiceTitleList, ServiceKey } from './Title';
import { Runtime, RequestStatus } from './Runtime';
import { Options } from './Options';
import { GetService } from './Service';
import { SyncDex } from './SyncDex';

interface ServiceOverview {
	service: Promise<ServiceTitle | RequestStatus>;
	key: ActivableKey;
	tab: HTMLLIElement;
	body: HTMLElement;
	content: HTMLElement;
	manage: HTMLElement;
	syncing?: HTMLElement;
}

export class Overview {
	title: Title;
	services: ServiceTitleList;
	syncDex: SyncDex;
	row: HTMLElement;
	column: HTMLElement;
	serviceList: HTMLUListElement;
	bodies: HTMLElement;
	current?: ServiceOverview;
	overviews: Partial<{ [key in ActivableKey]: ServiceOverview }> = {};

	constructor(title: Title, services: ServiceTitleList, syncDex: SyncDex) {
		this.title = title;
		this.services = services;
		this.syncDex = syncDex;
		this.column = DOM.create('div', { class: 'overview col-lg-9 col-xl-10', textContent: 'Loading...' });
		this.row = DOM.create('div', {
			class: 'row m-0 py-1 px-0 border-top loading',
			childs: [DOM.create('div', { class: 'col-lg-3 col-xl-2 strong', textContent: 'SyncDex:' }), this.column],
		});
		const row = document.querySelector<HTMLElement>('.reading_progress')!.parentElement!;
		row.parentElement!.insertBefore(this.row, row);
		this.serviceList = DOM.create('ul', { class: 'tabs' });
		this.bodies = DOM.create('div', { class: 'bodies' });
	}

	alert = (type: 'warning' | 'danger', content: string | AppendableElement[]): HTMLElement => {
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

	syncButton = (serviceKey: ActivableKey, service: ServiceTitle): HTMLButtonElement => {
		const overview = this.overviews[serviceKey]!;
		return overview.manage.appendChild(
			DOM.create('button', {
				class: 'btn btn-primary sync-button',
				childs: [DOM.icon('sync-alt'), DOM.space(), DOM.text('Sync')],
				events: {
					click: (event) => {
						event.preventDefault();
						this.isSyncing(serviceKey);
						service.import(this.title);
						service.persist().then((res) => {
							if (res > RequestStatus.CREATED) this.updateOverview(serviceKey, res);
							else this.updateOverview(serviceKey, service);
						});
					},
				},
			})
		);
	};

	isSyncing = (serviceKey: ActivableKey): void => {
		const overview = this.overviews[serviceKey]!;
		overview.syncing = DOM.create('div', {
			class: 'syncing',
			childs: [DOM.icon('sync-alt fa-spin'), DOM.space(), DOM.text('Syncing...')],
		});
		overview.body.appendChild(overview.syncing);
	};

	updateOverview = (serviceKey: ActivableKey, service: ServiceTitle | RequestStatus): void => {
		const overview = this.overviews[serviceKey]!;
		if (service instanceof ServiceTitle) {
			this.clearOverview(overview);
			service.overview(overview.content);
			// Display *Sync* button only if the title is out of sync, with auto sync disabled and if the title is in a list
			if (!Options.autoSync && !service.isSynced(this.title) && this.title.status !== Status.NONE) {
				this.syncButton(serviceKey, service);
			}
		} else this.errorMessage(serviceKey, service);
	};

	activateOverview = (overview: ServiceOverview): void => {
		this.disableOverview();
		this.current = overview;
		overview.tab.classList.add('active');
		overview.body.classList.remove('hidden');
		this.column.classList.add(overview.key);
	};

	disableOverview = (): void => {
		if (this.current) {
			this.current.tab.classList.remove('active');
			this.current.body.classList.add('hidden');
			this.column.classList.remove(this.current.key);
		}
	};

	clearOverview = (overview: ServiceOverview): void => {
		DOM.clear(overview.content);
		DOM.clear(overview.manage);
		if (overview.syncing) {
			overview.syncing.remove();
			overview.syncing = undefined;
		}
	};

	refreshButton = (serviceKey: ActivableKey): HTMLButtonElement => {
		const button = DOM.create('button', {
			class: 'btn btn-primary',
			textContent: 'Refresh',
			events: {
				click: async (event) => {
					event.preventDefault();
					if (!this.title.services[serviceKey]) return;
					button.classList.add('loading');
					button.disabled = true;
					await Options.load();
					this.services[serviceKey] = GetService(ReverseActivableName[serviceKey]).get(
						this.title.services[serviceKey]!
					);
					await this.syncDex.syncServices(this.title, this.services, this);
					button.classList.remove('loading');
					button.disabled = false;
				},
			},
		});
		return button;
	};

	openOptionsButton = (): HTMLButtonElement => {
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

	errorMessage = (serviceKey: ActivableKey, res: RequestStatus): void => {
		const overview = this.overviews[serviceKey]!;
		this.clearOverview(overview);
		switch (res) {
			case RequestStatus.MISSING_TOKEN:
				overview.content.appendChild(
					this.alert('danger', [
						DOM.text('Missing Token, check your Login Status in the Options.'),
						DOM.space(),
						this.refreshButton(serviceKey),
						DOM.space(),
						this.openOptionsButton(),
					])
				);
				break;
			case RequestStatus.BAD_REQUEST:
				overview.content.appendChild(this.alert('danger', 'Bad Request, if this happen again open an issue.'));
				break;
			case RequestStatus.NOT_FOUND:
				overview.content.appendChild(
					this.alert('danger', 'The Media was not found on the Service, probably a bad ID.')
				);
				break;
			case RequestStatus.SERVER_ERROR:
				overview.content.appendChild(
					this.alert('danger', [
						DOM.text('Server Error, the Service might be down, retry later.'),
						DOM.space(),
						this.refreshButton(serviceKey),
					])
				);
				break;
		}
	};

	displayServices = (): void => {
		DOM.clear(this.column);
		// Select Services to display
		if (Options.services.length == 0) {
			this.column.appendChild(
				this.alert('warning', `You have no active Services, SyncDex won't do anything until you activate one.`)
			);
			this.row.classList.remove('loading');
			return;
		}
		let displayServices = Object.keys(this.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		if (Options.overviewMainOnly) {
			displayServices = displayServices.filter((key) => key == Options.mainService);
		}
		if (displayServices.length == 0) {
			this.column.appendChild(this.alert('warning', `No Available Services for you for this Title.`));
			this.row.classList.remove('loading');
			return;
		}
		// Display Service tabs
		DOM.append(this.column, this.serviceList, this.bodies);
		let i = 0;
		for (const key of displayServices) {
			const serviceKey = key as ActivableKey;
			const serviceOverview: ServiceOverview = {
				key: serviceKey,
				tab: DOM.create('li', {
					class: `tab ${serviceKey}`,
					childs: [
						DOM.create('img', { src: Runtime.file(`/icons/${serviceKey}.png`) }),
						DOM.space(),
						DOM.text(ReverseActivableName[serviceKey]),
					],
					events: {
						click: (event) => {
							event.preventDefault();
							this.activateOverview(serviceOverview);
						},
					},
				}),
				content: DOM.create('div', { class: 'content', textContent: 'Loading...' }),
				manage: DOM.create('div', { class: 'manage' }),
				body: DOM.create('div', { class: 'body hidden' }),
				service: this.services[serviceKey]!.then((res) => {
					this.updateOverview(serviceKey, res);
					return res;
				}),
			};
			DOM.append(serviceOverview.body, serviceOverview.content, serviceOverview.manage);
			if (Options.mainService == serviceKey) serviceOverview.tab.classList.add('main');
			this.overviews[serviceKey] = serviceOverview;
			if (i++ == 0) {
				this.activateOverview(serviceOverview);
			}
			this.serviceList.appendChild(serviceOverview.tab);
			this.bodies.appendChild(serviceOverview.body);
		}
		this.row.classList.remove('loading');
	};
}

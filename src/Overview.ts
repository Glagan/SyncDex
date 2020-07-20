import { DOM, AppendableElement } from './DOM';
import { Title, ServiceTitle, ActivableKey, ReverseActivableName, ServiceTitleList, ServiceKey } from './Title';
import { Runtime, RequestStatus } from './Runtime';
import { Options } from './Options';

interface ServiceOverview {
	service: Promise<ServiceTitle | RequestStatus>;
	key: ActivableKey;
	tab: HTMLLIElement;
	body: HTMLElement;
}

export class Overview {
	title: Title;
	row: HTMLElement;
	column: HTMLElement;
	serviceList: HTMLUListElement;
	bodies: HTMLElement;
	current?: ServiceOverview;
	overviews: Partial<{ [key in ActivableKey]: ServiceOverview }> = {};

	constructor(title: Title) {
		this.title = title;
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
		return DOM.create('button', {
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
		});
	};

	isSyncing = (serviceKey: ActivableKey): void => {
		const overview = this.overviews[serviceKey]!;
		overview.body.appendChild(
			DOM.create('div', {
				class: 'syncing',
				childs: [DOM.icon('sync-alt fa-spin'), DOM.space(), DOM.text('Syncing...')],
			})
		);
	};

	updateOverview = (serviceKey: ActivableKey, service: ServiceTitle | RequestStatus): void => {
		const overview = this.overviews[serviceKey]!;
		if (service instanceof ServiceTitle) {
			DOM.clear(overview.body);
			service.overview(overview.body);
			if (!Options.autoSync && !service.isSynced(this.title)) {
				overview.body.appendChild(this.syncButton(serviceKey, service));
			}
		} else this.errorMessage(service, overview);
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

	errorMessage = (res: RequestStatus, overview: ServiceOverview): void => {
		DOM.clear(overview.body);
		switch (res) {
			case RequestStatus.MISSING_TOKEN:
				overview.body.appendChild(
					this.alert('danger', [
						DOM.text('Missing Token, check your Login Status in the Options.'),
						DOM.space(),
						this.openOptionsButton(),
					])
				);
				break;
			case RequestStatus.BAD_REQUEST:
				overview.body.appendChild(this.alert('danger', 'Bad Request, if this happen again open an issue.'));
				break;
			case RequestStatus.SERVER_ERROR:
				overview.body.appendChild(
					this.alert('danger', 'Server Error, the Service might be down, retry later.')
				);
				break;
			case RequestStatus.NOT_FOUND:
				overview.body.appendChild(
					this.alert('danger', 'The Media was not found on the Service, probably a bad ID.')
				);
				break;
		}
	};

	displayServices = (services: ServiceTitleList): void => {
		DOM.clear(this.column);
		// Select Services to display
		if (Options.services.length == 0) {
			this.column.appendChild(
				this.alert('warning', `You have no active Services, SyncDex won't do anything until you activate one.`)
			);
			this.row.classList.remove('loading');
			return;
		}
		let displayServices = Object.keys(services).filter((key) => Options.services.indexOf(key as ActivableKey) >= 0);
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
				body: DOM.create('div', { class: 'body hidden', textContent: 'Loading...' }),
				service: services[serviceKey]!.then((res) => {
					this.updateOverview(serviceKey, res);
					return res;
				}),
			};
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

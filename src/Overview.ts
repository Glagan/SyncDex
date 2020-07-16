import { DOM } from './DOM';
import { Title, ServiceKey, ReverseServiceName, ServiceTitle, ActivableKey, ReverseActivableName } from './Title';
import { Runtime, RequestStatus } from './Runtime';
import { Options } from './Options';
import { GetService } from './Service';

interface ServiceOverview {
	key: ActivableKey;
	tab: HTMLLIElement;
	body: HTMLElement;
}

export class Overview {
	row: HTMLElement;
	column: HTMLElement;
	serviceList: HTMLUListElement;
	bodies: HTMLElement;
	current?: ServiceOverview;
	overviews: ServiceOverview[] = [];

	constructor() {
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

	finish = (): void => {
		this.row.classList.remove('loading');
	};

	alert = (type: 'warning' | 'danger', content: string): HTMLElement => {
		return DOM.create('div', {
			class: `alert alert-${type}`,
			textContent: content,
		});
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

	errorMessage = (res: RequestStatus, overview: ServiceOverview): void => {
		DOM.clear(overview.body);
		switch (res) {
			case RequestStatus.MISSING_TOKEN:
				overview.body.appendChild(
					this.alert('danger', 'Missing Token, check your Login Status in the Options.')
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

	load = (title: Title): void => {
		DOM.clear(this.column);
		if (Options.services.length == 0) {
			this.column.appendChild(
				this.alert('warning', `You have no active Services, SyncDex won't do anything until you activate one.`)
			);
			return this.finish();
		}
		// Get Service Keys
		let displayServices = Object.keys(title.services).filter(
			(key) => Options.services.indexOf(key as ActivableKey) >= 0
		);
		if (Options.overviewMainOnly) {
			displayServices = displayServices.filter((key) => key == Options.mainService);
		}
		if (displayServices.length == 0) {
			this.column.appendChild(this.alert('warning', `No Available Services for you for this Title.`));
			return this.finish();
		}
		// Order the found Services by the User's Service order
		const ordered = [];
		for (const service of Options.services) {
			if (displayServices.indexOf(service) >= 0) {
				ordered.push(service);
			}
		}
		displayServices = ordered;
		// Display Service tabs
		DOM.append(this.column, this.serviceList, this.bodies);
		for (const key of displayServices) {
			const serviceKey = key as ActivableKey;
			const serviceName = ReverseActivableName[serviceKey];
			const serviceOverview = {
				key: serviceKey,
				tab: DOM.create('li', {
					class: `tab ${serviceKey}`,
					childs: [
						DOM.create('img', { src: Runtime.file(`/icons/${serviceKey}.png`) }),
						DOM.space(),
						DOM.text(serviceName),
					],
					events: {
						click: (event) => {
							event.preventDefault();
							this.activateOverview(serviceOverview);
						},
					},
				}),
				body: DOM.create('div', { class: 'body hidden', textContent: 'Loading...' }),
			};
			if (Options.mainService == serviceKey) serviceOverview.tab.classList.add('main');
			this.overviews.push(serviceOverview);
			if (this.overviews.length == 1) {
				this.activateOverview(serviceOverview);
			}
			this.serviceList.appendChild(serviceOverview.tab);
			this.bodies.appendChild(serviceOverview.body);
			// Load ServiceTitle
			const serviceTitle = GetService(serviceName)
				.get(title.services[serviceKey]!)
				.then((res) => {
					if (res instanceof ServiceTitle) {
						DOM.clear(serviceOverview.body);
						res.overview(serviceOverview.body);
					} else this.errorMessage(res, serviceOverview);
				});
		}
		this.finish();
	};
}

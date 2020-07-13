import { DOM } from './DOM';
import { Title, ServiceKey, ReverseServiceName } from './Title';
import { Runtime } from './Runtime';
import { Options } from './Options';

export class Overview {
	row: HTMLElement;
	serviceList: HTMLUListElement;
	column: HTMLElement;
	body: HTMLElement;

	constructor() {
		this.column = DOM.create('div', { class: 'overview col-lg-9 col-xl-10', textContent: 'Loading...' });
		this.row = DOM.create('div', {
			class: 'row m-0 py-1 px-0 border-top loading',
			childs: [DOM.create('div', { class: 'col-lg-3 col-xl-2 strong', textContent: 'SyncDex:' }), this.column],
		});
		const row = document.querySelector<HTMLElement>('.reading_progress')!.parentElement!;
		row.parentElement!.insertBefore(this.row, row);
		this.serviceList = DOM.create('ul', { class: 'tabs' });
		this.body = DOM.create('div', { class: 'body' });
	}

	load = (title: Title): void => {
		if (Options.services.length == 0) {
			this.column.appendChild(
				DOM.create('div', {
					class: 'alert alert-warning',
					textContent: `You have no active Services, SyncDex won't do anything until you activate one.`,
				})
			);
			return;
		}
		// Get Service Keys
		const displayServices = Object.keys(title.services).filter(
			(key) => Options.services.indexOf(ReverseServiceName[key as ServiceKey]) >= 0
		);
		if (displayServices.length == 0) {
			this.column.appendChild(
				DOM.create('div', {
					class: 'alert alert-warning',
					textContent: `No Available Services for this Title.`,
				})
			);
			return;
		}
		// Display Service tabs
		let previousButton: HTMLElement | undefined;
		let previousService = '';
		for (const key of displayServices) {
			const serviceKey = key as ServiceKey;
			const serviceButton = DOM.create('li', {
				class: `tab ${serviceKey}`,
				childs: [
					DOM.create('img', { src: Runtime.file(`/icons/${serviceKey}.png`) }),
					DOM.space(),
					DOM.text(ReverseServiceName[serviceKey]),
				],
				events: {
					click: (event) => {
						event.preventDefault();
						if (previousButton) {
							previousButton.classList.remove('active');
							this.column.classList.remove(previousService);
						}
						previousButton = serviceButton;
						previousService = serviceKey;
						serviceButton.classList.add('active');
						this.column.classList.add(serviceKey);
					},
				},
			});
			if (previousService == '') {
				previousButton = serviceButton;
				previousService = serviceKey;
				serviceButton.classList.add('active');
				this.column.classList.add(serviceKey);
			}
			this.serviceList.append(serviceButton);
		}
		DOM.append(this.column, this.serviceList, this.body);
	};
}

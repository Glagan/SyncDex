import { setBrowser } from '../src/Browser';
import { Options } from '../src/Options';
import { DOM } from '../src/DOM';
import { ServiceName, ServiceKey, Service } from '../src/Service/Service';
import { MyAnimeList } from '../src/Service/MyAnimeList';
import { Anilist } from '../src/Service/Anilist';
import { Kitsu } from '../src/Service/Kitsu';
import { MangaUpdates } from '../src/Service/MangaUpdates';
import { AnimePlanet } from '../src/Service/AnimePlanet';
import { CheckboxManager } from './Manager/Checkbox';
import { ColorManager } from './Manager/Color';
import { HighlightsManager } from './Manager/HighlightsManager';
import { MenuHighlight } from './MenuHighlight';
import { InputManager } from './Manager/Input';

function serviceByName(name: ServiceName, options: Options): Service {
	switch (name) {
		case ServiceName.MyAnimeList:
			return new MyAnimeList(options);
		case ServiceName.Anilist:
			return new Anilist(options);
		case ServiceName.Kitsu:
			return new Kitsu(options);
		case ServiceName.MangaUpdates:
			return new MangaUpdates(options);
		case ServiceName.AnimePlanet:
			return new AnimePlanet(options);
	}
}

class Services {
	options: Options;
	node: HTMLElement;
	list: { [key in ServiceName]?: Service | undefined } = {};
	selector: HTMLElement;

	constructor(node: HTMLElement, options: Options) {
		this.options = options;
		this.node = node;
		this.selector = this.createAddForm();
	}

	add = async (name: ServiceName): Promise<void> => {
		const isMain = this.options.mainService == name;
		this.list[name] = serviceByName(name, this.options);
		const block = DOM.create('div', {
			class: 'service',
		});
		const title = DOM.create('title', {
			class: 'title',
			childs: [
				DOM.create('img', {
					attributes: { src: `/icons/${ServiceKey[name]}.png` },
				}),
				DOM.space(),
				this.createTitle(name),
			],
		});
		const buttons = DOM.create('div', { class: 'button-group' });
		if (!isMain) {
			const setMainButton = DOM.create('button', {
				class: 'default',
				attributes: { title: 'Set as main' },
				childs: [DOM.create('i', { class: 'lni lni-angle-double-left' })],
				events: {
					click: () => {
						// Make service the first in the list
						const index = this.options.services.indexOf(name);
						this.options.services.splice(
							0,
							0,
							this.options.services.splice(index, 1)[0]
						);
						this.options.mainService = name;
						this.options.save();
						// Remove main button and add the main button to the old main
						setMainButton.remove();
						const oldMain = this.node.querySelector('.service.main') as HTMLElement;
						oldMain.classList.remove('main');
						const oldMainButtons = oldMain.querySelector('.button-group');
						oldMainButtons?.insertBefore(
							DOM.create('button', {
								// Recursive, todo: createMainButton function
							}),
							oldMainButtons.firstElementChild
						);
						block.classList.add('main');
					},
				},
			});
			DOM.append(buttons, setMainButton);
		}
		DOM.append(
			buttons,
			DOM.create('button', {
				class: 'action',
				attributes: { title: 'Check login status' },
				childs: [DOM.create('i', { class: 'lni lni-reload' })],
			}),
			DOM.create('button', {
				class: 'danger grow',
				childs: [
					DOM.create('i', { class: 'lni lni-cross-circle' }),
					DOM.space(),
					DOM.text('Remove'),
				],
				events: {
					click: () => {
						// Remove service from Service list and assign new main if possible
						const index = this.options.services.indexOf(name);
						if (index > -1) {
							this.options.services.splice(index, 1);
							if (this.options.mainService == name) {
								this.options.mainService =
									this.options.services.length > 0
										? this.options.services[0]
										: undefined;
							}
						}
						this.options.save();
						// Remove service block and add the option back to the selector
						block.remove();
						DOM.append(
							this.selector,
							DOM.create('option', {
								textContent: name,
								attributes: {
									value: name,
								},
							})
						);
						// Add back the 'main' class to the next service
						if (this.options.mainService) {
							this.node.firstElementChild?.classList.add('main');
						}
					},
				},
			})
		);
		DOM.append(block, title, buttons);
		if (isMain) {
			block.classList.add('main');
			this.node.insertBefore(block, this.node.firstElementChild);
		} else {
			this.node.insertBefore(block, this.node.lastElementChild);
		}
		if (!(await this.list[name]?.loggedIn())) {
			block.classList.add('inactive');
		} else {
			block.classList.add('active');
		}
		const option = this.selector.querySelector(`[value="${name}"]`);
		if (option) {
			option.remove();
		}
	};

	createTitle = (serviceName: ServiceName): HTMLElement => {
		if (serviceName == ServiceName.Anilist) {
			return DOM.create('span', {
				class: serviceName.toLowerCase(),
				textContent: 'Ani',
				childs: [
					DOM.create('span', {
						class: 'list',
						textContent: 'list',
					}),
				],
			});
		}
		return DOM.create('span', {
			class: serviceName.toLowerCase(),
			textContent: serviceName,
		});
	};

	createAddForm = (): HTMLElement => {
		const block = DOM.create('div', {
			class: 'service add',
		});
		const selector = DOM.create('select', {
			childs: [DOM.create('option', { textContent: 'Select Service' })],
		});
		for (const service in ServiceName) {
			if (isNaN(Number(service))) {
				DOM.append(
					selector,
					DOM.create('option', {
						textContent: service,
						attributes: {
							value: service,
						},
					})
				);
			}
		}
		const button = DOM.create('button', {
			class: 'success',
			childs: [
				DOM.create('i', { class: 'lni lni-circle-plus' }),
				DOM.space(),
				DOM.text('Add'),
			],
			events: {
				click: async (): Promise<any> => {
					if (selector.value != 'Select Service') {
						const name: ServiceName = selector.value as ServiceName;
						this.list[name] = serviceByName(name, this.options);
						if (this.options.services.length == 0) {
							this.options.mainService = name;
						}
						this.options.services.push(name);
						this.options.save();
						this.add(name);
					}
				},
			},
		});
		this.node.appendChild(DOM.append(block, selector, button));
		return selector;
	};
}

class OptionsManager {
	options: Options = new Options();
	services: Services | null = null;

	highlightsManager?: HighlightsManager;
	colorManager?: ColorManager;
	checkboxManager?: CheckboxManager;
	inputManager?: InputManager;
	menuHighlight?: MenuHighlight;

	initialize = async (): Promise<void> => {
		await this.options.load();
		// console.log(this.options);
		this.highlightsManager = new HighlightsManager(this.options);
		this.colorManager = new ColorManager(this.options);
		this.checkboxManager = new CheckboxManager(this.options);
		this.inputManager = new InputManager(this.options);
		this.menuHighlight = new MenuHighlight(document.getElementById('content') as HTMLElement);
		// TODO: Services
		this.services = new Services(
			document.querySelector('.services') as HTMLElement,
			this.options
		);
		for (let index = 0; index < this.options.services.length; index++) {
			const serviceName = this.options.services[index];
			this.services.add(serviceName);
		}
	};
}

setBrowser();
const manager = new OptionsManager();
manager.initialize();

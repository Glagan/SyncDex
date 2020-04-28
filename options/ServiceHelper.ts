import { DOM } from '../src/DOM';
import { ServiceName } from '../src/Service/Service';

export class ServiceHelper {
	static createBlock(name: string, key: string): HTMLElement {
		let node = DOM.create('div', {
			class: `service ${name.toLowerCase()}`,
		});
		const title = DOM.create('span', {
			class: 'title',
			childs: [
				DOM.create('img', {
					attributes: { src: `/icons/${key}.png` },
				}),
				DOM.space(),
				ServiceHelper.createTitle(name),
			],
		});
		return DOM.append(node, title);
	}

	static createTitle(name: string): HTMLElement {
		if (name == ServiceName.Anilist) {
			return DOM.create('span', {
				class: name.toLowerCase(),
				textContent: 'Ani',
				childs: [
					DOM.create('span', {
						class: 'list',
						textContent: 'List',
					}),
				],
			});
		}
		return DOM.create('span', {
			class: name.toLowerCase(),
			textContent: name,
		});
	}
}

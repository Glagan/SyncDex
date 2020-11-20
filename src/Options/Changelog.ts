import { DOM } from '../Core/DOM';
import * as changelog from '../changelog.json';
import { Modal } from '../Core/Modal';
import { Options } from '../Core/Options';

export class Changelog {
	static openModal(showVersion: boolean): void {
		const modal = new Modal('medium');
		if (showVersion) {
			modal.header.textContent = 'SyncDex Update';
			modal.body.appendChild(
				DOM.create('p', {
					class: 'paragraph',
					childs: [
						DOM.text('SyncDex has been updated to version '),
						DOM.create('b', { textContent: `${Options.version}` }),
						DOM.text('.'),
					],
				})
			);
			modal.body.appendChild(DOM.create('h2', { textContent: 'Changelog' }));
		} else {
			modal.header.textContent = 'Changelog';
		}
		modal.body.appendChild(this.generate());
		modal.show();
	}

	static generate(): HTMLElement {
		const main = DOM.create('ul', { class: 'changelog' });
		for (const update of changelog.updates) {
			const version = DOM.create('li', { class: 'section', textContent: update.version });
			if (parseFloat(update.version) == Options.version) {
				DOM.append(
					version,
					DOM.space(),
					DOM.create('span', { class: 'helper', textContent: '(Your version)' })
				);
			}
			const description = DOM.create('ul');
			for (const line of update.description) {
				description.appendChild(DOM.create('li', { textContent: line }));
			}
			DOM.append(main, DOM.append(version, description));
		}
		return main;
	}
}

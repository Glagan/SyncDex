import { DOM } from '../Core/DOM';
import { Log, loadLogs } from '../Core/Log';
import { Storage } from '../Core/Storage';

export class Logs {
	container: HTMLElement;
	clearButton: HTMLButtonElement;
	reloadButton: HTMLButtonElement;

	constructor() {
		this.container = document.getElementById('logs-container') as HTMLElement;
		this.clearButton = document.getElementById('clear-logs') as HTMLButtonElement;
		this.clearButton.addEventListener('click', async (event) => {
			event.preventDefault();
			this.clearButton.disabled = true;
			DOM.clear(this.container);
			this.displayEmptyMessage();
			Log.logs = [];
			await Storage.set(StorageUniqueKey.Logs, []);
			this.clearButton.disabled = false;
		});
		this.reloadButton = document.getElementById('reload-logs') as HTMLButtonElement;
		this.reloadButton.addEventListener('click', async (event) => {
			event.preventDefault();
			this.reloadButton.disabled = true;
			await this.reload();
			this.reloadButton.disabled = false;
		});
		this.reload();
	}

	displayEmptyMessage = (): void => {
		this.container.appendChild(
			DOM.create('tr', {
				childs: [
					DOM.create('td', {
						colSpan: 3,
						childs: [
							DOM.create('div', {
								class: 'message',
								childs: [
									DOM.create('div', { class: 'icon' }),
									DOM.create('div', {
										class: 'content',
										textContent: 'No logs, yet.',
									}),
								],
							}),
						],
					}),
				],
			})
		);
	};

	async reload() {
		DOM.clear(this.container);
		const logs = await loadLogs(true);
		if (logs.length == 0) {
			this.displayEmptyMessage();
		} else {
			let current = logs.length;
			for (const line of [...logs].reverse()) {
				this.container.appendChild(
					DOM.create('tr', {
						childs: [
							DOM.create('td', { textContent: `${current--}` }),
							DOM.create('td', { textContent: `${new Date(line.d).toLocaleString()}` }),
							DOM.create('td', { class: 'data', title: line.msg, textContent: line.msg }),
						],
					})
				);
			}
		}
	}
}

import { ServiceSave } from './Save';
import { DOM } from '../../src/DOM';
import { Progress } from '../../src/interfaces';
import { Status } from '../../src/Service/Service';
import { Runtime, RawResponse } from '../../src/Runtime';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';

interface MUTitle {
	id: number;
	progress: Progress;
	status: Status;
}

export class MangaUpdates extends ServiceSave {
	name: string = 'MangaUpdates';
	key: string = 'mu';
	parser: DOMParser = new DOMParser();
	static lists: string[] = ['read', 'wish', 'complete', 'unfinished', 'hold'];

	import = (): void => {
		this.manager.clear();
		this.manager.header('Importing from MangaUpdates');
		const block = DOM.create('div', {
			class: 'block',
		});
		const startButton = DOM.create('button', {
			class: 'success mr-1',
			textContent: 'Start',
			events: {
				click: async (event): Promise<void> => {
					event.preventDefault();
					this.handleImport();
				},
			},
		});
		DOM.append(this.manager.node, DOM.append(block, startButton, this.resetButton()));
	};

	getProgress = (node: HTMLElement | null): number => {
		if (node !== null) {
			return parseInt((node.textContent as string).slice(2));
		}
		return 0;
	};

	toStatus = (list: string): Status => {
		if (list === 'read') {
			return Status.READING;
		} else if (list === 'wish') {
			return Status.PLAN_TO_READ;
		} else if (list === 'complete') {
			return Status.COMPLETED;
		} else if (list === 'unfinished') {
			return Status.DROPPED;
		} else if (list === 'hold') {
			return Status.PAUSED;
		}
		return Status.NONE;
	};

	listPage = async (titles: MUTitle[], list: string): Promise<boolean> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://www.mangaupdates.com/mylist.html?list=${list}`,
			credentials: 'include',
		});
		if (
			response.status >= 200 &&
			response.status < 400 &&
			response.body.indexOf('You must be a user to access this page.') < 0
		) {
			const body = this.parser.parseFromString(response.body, 'text/html');
			const rows = body.querySelectorAll(`div[id^='r']`);
			const status = this.toStatus(list);
			for (let index = 0, len = rows.length; index < len; index++) {
				const row = rows[index];
				titles.push({
					id: parseInt(row.id.slice(1)),
					progress: {
						chapter: this.getProgress(row.querySelector(`a[title='Increment Chapter']`)),
						volume: this.getProgress(row.querySelector(`a[title='Increment Volume']`)),
					},
					status: status,
				});
			}
			return true;
		}
		return false;
	};

	handleImport = async (): Promise<void> => {
		this.manager.clear();
		this.removeNotifications();
		this.manager.header('Importing from MangaUpdates');
		let notification = this.notification('info loading', `Importing list 1 out of 5.`);
		let muTitles: MUTitle[] = [];
		for (let index = 0, len = MangaUpdates.lists.length; index < len; index++) {
			const listName = MangaUpdates.lists[index];
			notification.textContent = `Importing list ${index + 1} out of 5.`;
			if (!(await this.listPage(muTitles, listName))) {
				break;
			}
		}
		notification.classList.remove('loading');
		// Find MangaDex IDs
		let titles = new TitleCollection();
		const total = muTitles.length;
		let added = 0;
		this.notification('success', `Found a total of ${muTitles.length} Titles.`);
		notification = this.notification(
			'info loading',
			`Finding MangaDex IDs from MangaUpdates IDs, 0 out of ${total}.`
		);
		for (let index = 0; index < total; index++) {
			const muTitle = muTitles[index];
			const connections = await Mochi.find(muTitle.id, 'MangaUpdates');
			if (connections !== undefined) {
				for (let index = 0, len = connections.length; index < len; index++) {
					const connection = connections[index];
					if (connection.service === 'MangaDex') {
						titles.add(
							new Title(connection.id as number, {
								services: { mu: muTitle.id },
								progress: muTitle.progress,
								status: muTitle.status,
								chapters: [],
							})
						);
						added++;
						break;
					}
				}
			}
			notification.textContent = `Finding MangaDex IDs from MangaUpdates IDs, ${index + 1} out of ${total}.`;
		}
		// Done, merge and save
		notification.classList.remove('loading');
		titles.merge(await TitleCollection.get(titles.ids));
		await titles.save();
		this.success([
			DOM.text(`Done ! Imported ${added} Titles (out of ${total}) from MangaUpdates.`),
			DOM.space(),
			this.resetButton(),
		]);
	};

	export = (): void => {};
}

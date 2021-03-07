import { DOM } from './DOM';
import { ModuleInterface } from './ModuleInterface';
import { Service } from './Service';
import { FoundTitle } from './Title';
import { Mochi } from './Mochi';
import { Storage } from './Storage';
import { Options } from './Options';
import { Request } from './Request';
import { log } from './Log';
import { ServiceKey } from '../Service/Keys';
import { LocalTitle, TitleCollection } from './Title';
import { MangaDex } from './MangaDex';
import { Extension } from './Extension';

export const enum ModuleStatus {
	SUCCESS,
	CANCEL,
	LOGIN_FAIL,
	PREXECUTE_FAIL,
	EXECUTE_FAIL,
	GENERAL_FAIL,
}

/**
 * Convert a duration in ms to a string
 */
export function duration(time: number): string {
	if (time == 0) return '0s';
	const diff = Math.floor(time / 1000);
	let r = [];
	let p: Partial<Record<'hours' | 'mins' | 'sec' | 'msec', number>> = {};
	if ((p.hours = Math.floor((diff % 86400) / 3600)) > 0) r.push(p.hours, `hour${p.hours > 1 ? 's' : ''} `);
	if ((p.mins = Math.floor((diff % 3600) / 60)) > 0) r.push(p.mins, `minute${p.mins > 1 ? 's' : ''} `);
	if ((p.sec = Math.floor(diff % 60)) > 0) r.push(p.sec, 's ');
	if ((p.msec = Math.floor(time % 1000)) > 100) r.push(p.msec, 'ms ');
	return r.join('').trim();
}

export interface SummaryTitle {
	name?: string;
	key: MediaKey;
	services?: ServiceList;
}

export class Summary {
	total: number = 0;
	valid: number = 0;
	failed: SummaryTitle[] = [];
	startTime: number = 0;
	options: number = 0;
	history: boolean = false;

	constructor() {
		this.start();
	}

	start = (): void => {
		this.startTime = Date.now();
	};

	totalTime = (): string => {
		return duration(Date.now() - this.startTime);
	};
}

export interface ModuleOption {
	description: string;
	default: boolean;
	active?: boolean;
	display: boolean;
}
export type ModuleOptions = { [key: string]: ModuleOption };

/**
 * Abstract Module with a simple single `execute` function that need to be written.
 * An optionnal ModuleInterface can be provided and need to be checked before calling it in `execute`.
 */
export abstract class Module {
	service: Service;
	interface?: ModuleInterface;
	summary: Summary;
	perConvert: number = 250;
	abstract options: ModuleOptions;

	extendOptions?(): void;

	constructor(service: Service, moduleInterface?: ModuleInterface) {
		this.service = service;
		this.interface ??= moduleInterface;
		this.summary = new Summary();
	}

	bindInterface = (): void => {
		if (this.interface) {
			this.interface.createOptions(this.options);
			this.interface.setStyle(this.service.createTitle(), this.service.key);
			this.interface.bindFormSubmit(() => this.run());
		}
	};

	summaryFailBlock = (parent: HTMLElement): HTMLElement => {
		const failedBlock = DOM.create('ul', { class: 'failed' });
		DOM.append(
			parent,
			DOM.create('button', {
				class: 'micro',
				textContent: 'Show',
				events: {
					click: (event) => {
						event.preventDefault();
						if (!failedBlock.classList.contains('open')) {
							failedBlock.classList.add('open');
							failedBlock.classList.remove('closed');
						} else {
							failedBlock.classList.remove('open');
							failedBlock.classList.add('closed');
						}
					},
				},
			}),
			failedBlock
		);
		return failedBlock;
	};

	checkCancel = (): boolean => {
		return !!this.interface?.doStop;
	};

	checkLogin = async (): Promise<boolean> => {
		const notification = this.interface?.message('loading', 'Checking login status...');
		const loggedIn = (await this.service.loggedIn()) === ResponseStatus.SUCCESS;
		notification?.classList.remove('loading');
		return loggedIn;
	};

	setOptions = (): void => {
		for (const name in this.options) {
			this.options[name].active = this.options[name].default;
		}
		this.interface?.setOptionsValues(this.options);
	};

	abstract run(): Promise<ModuleStatus>;

	mochiCheck = async (collection: TitleCollection): Promise<void> => {
		const progress = DOM.create('span', {
			textContent: 'Page 1 out of 1',
		});
		const notification = this.interface?.message('loading', [
			DOM.create('p', { textContent: 'Checking Services with Mochi... ', childs: [progress] }),
		]);
		let offset = 0;
		let max = Math.ceil(collection.length / 250);
		for (let i = 0; !this.interface?.doStop && i < max; i++) {
			progress.textContent = `Page ${i + 1} out of ${max}`;
			const titleList = collection.collection.slice(offset, offset + 250);
			offset += 250;
			const connections = await Mochi.findMany(titleList.map((title) => title.key.id!));
			if (connections !== undefined) {
				for (const titleId in connections) {
					const id = parseInt(titleId);
					const title = titleList.find((t) => t.key.id == id);
					if (title) Mochi.assign(title, connections[titleId]);
				}
			}
		}
		if (notification) notification.classList.remove('loading');
	};
}

export abstract class ImportModule extends Module {
	found: FoundTitle[] = [];
	options: ModuleOptions = {
		merge: {
			description: 'Merge with current local save',
			display: true,
			default: true,
		},
		save: {
			description: 'Save all Titles found with the Import',
			display: false,
			default: true,
		},
	};

	constructor(service: Service, moduleInterface?: ModuleInterface) {
		super(service, moduleInterface);
		if (this.extendOptions) this.extendOptions();
		this.bindInterface();
	}

	async preExecute?(): Promise<boolean>;
	abstract execute(): Promise<boolean>;
	async postExecute?(): Promise<void>;

	displaySummary = (): void => {
		if (this.interface) {
			if (this.summary.total != this.summary.valid) {
				const content = DOM.create('p', {
					textContent: `${this.summary.failed.length} titles were not imported since they had invalid or missing properties.`,
				});
				this.interface.message('warning', [content]);
				if (this.summary.failed.length > 0) {
					const failedBlock = this.summaryFailBlock(content);
					for (const title of this.summary.failed) {
						failedBlock.appendChild(
							DOM.create('li', {
								childs: [
									DOM.create('a', {
										target: '_blank',
										href: this.service.link(title.key),
										childs: [
											DOM.create('img', {
												src: Extension.icon(this.service.key),
												title: this.service.name,
											}),
											DOM.space(),
											DOM.text(title.name ?? '[No Name]'),
											DOM.space(),
											DOM.icon('external-link-alt'),
										],
										title: 'Open in new tab',
									}),
								],
							})
						);
					}
				}
			}
			let report = `Successfully imported ${this.summary.valid} titles`;
			if (this.summary.options > 0) {
				report += `${this.summary.history ? ', ' : ' and '} ${this.summary.options} Options`;
			}
			if (this.summary.history) report += ` and History`;
			report += ` in ${this.summary.totalTime()} !`;
			this.interface.message('success', report);
		}
	};

	run = async (): Promise<ModuleStatus> => {
		// Reset
		this.summary = new Summary();
		this.found = [];

		try {
			// Check login status
			const loginMessage = this.interface?.message('loading', 'Checking login status...');
			if ((await this.service.loggedIn()) !== ResponseStatus.SUCCESS) {
				loginMessage?.classList.remove('loading');
				this.interface?.message('error', `Importing need you to be logged in on ${this.service.name} !`);
				this.interface?.complete();
				return ModuleStatus.LOGIN_FAIL;
			}
			loginMessage?.classList.remove('loading');
			if (this.preExecute) {
				if (!(await this.preExecute())) return ModuleStatus.PREXECUTE_FAIL;
			}

			// Execute
			this.setOptions();
			const result = await this.execute();
			if (!result || this.interface?.doStop) {
				this.interface?.complete();
				if (this.interface?.doStop) {
					this.interface.message('warning', 'You cancelled the Import, nothing was saved.');
					return ModuleStatus.CANCEL;
				}
				return ModuleStatus.EXECUTE_FAIL;
			}
			this.interface?.message('default', `Found ${this.found.length} Titles on ${this.service.name}.`);
			this.summary.total = this.found.length;

			// Find MangaDex ID for all FoundTitle
			const titles = new TitleCollection();
			let current = 0;
			let progress = DOM.create('p');
			const notification = this.interface?.message('loading', [progress]);
			const max = Math.ceil(this.summary.total / this.perConvert);
			for (let i = 0; !this.interface?.doStop && i < max; i++) {
				const titleList = this.found.slice(current, current + this.perConvert);
				current += this.perConvert;
				progress.textContent = `Converting title ${Math.min(
					this.summary.total,
					current + this.perConvert
				)} out of ${this.summary.total}.`;
				const allConnections = await Mochi.findMany(
					titleList.map((t) => t.mochiKey),
					this.service.name
				);
				const found: (number | string)[] = [];
				if (allConnections !== undefined) {
					for (const key in allConnections) {
						const connections = allConnections[key];
						if (connections['md'] !== undefined) {
							const title = titleList.find((t) => t.mochiKey == key);
							if (title) {
								const localTitle = new LocalTitle(connections['md'], title);
								Mochi.assign(localTitle, connections);
								titles.add(localTitle);
								this.summary.valid++;
								found.push(title.mochiKey);
							}
						}
					}
				}
				// Add missing titles to the failed Summary
				this.summary.failed.push(...titleList.filter((t) => found.indexOf(t.mochiKey) < 0));
			}
			notification?.classList.remove('loading');
			if (this.interface?.doStop) {
				this.interface.message('warning', 'You cancelled the Import, nothing was saved.');
				this.interface.complete();
				return ModuleStatus.CANCEL;
			}

			// Merge
			if (!this.options.merge.active) {
				if (this.options.save.active) {
					// Keep options, logs, saveSync, import and lastSync
					const keep = await Storage.get([
						StorageUniqueKey.Options,
						StorageUniqueKey.Logs,
						StorageUniqueKey.LastSync,
						StorageUniqueKey.Import,
						StorageUniqueKey.SaveSync,
					]);
					await Storage.clear();
					await Storage.set(keep);
				}
			} else if (titles.length > 0) {
				(await TitleCollection.get(titles.ids)).mergeInto(titles);
			}

			// Add chapters
			if (Options.saveOpenedChapters) {
				for (const title of titles) {
					if (title.chapter > 0) {
						title.chapters = [];
						let index = Math.max(title.chapter - Options.chaptersSaved, 1);
						for (; index <= title.chapter; index++) {
							title.chapters.push(index);
						}
					}
				}
			}

			if (this.options.save.active) await titles.persist();
			this.displaySummary();
			this.interface?.complete();
			if (this.postExecute) await this.postExecute();
			return ModuleStatus.SUCCESS;
		} catch (error) {
			const line = await log(error);
			if (line) this.interface?.message('error', line.msg);
			this.interface?.complete();
			return ModuleStatus.GENERAL_FAIL;
		}
	};
}

export abstract class ExportModule extends Module {
	options: ModuleOptions = {
		mochi: {
			description: 'Check Services ID with Mochi before Exporting',
			display: true,
			default: true,
		},
	};

	constructor(service: Service, moduleInterface?: ModuleInterface) {
		super(service, moduleInterface);
		if (this.extendOptions) this.extendOptions();
		this.bindInterface();
	}

	async preExecute?(filtered: LocalTitle[]): Promise<boolean>;
	abstract execute(filtered: LocalTitle[]): Promise<boolean>;
	async postExecute?(): Promise<void>;

	displaySummary = (): void => {
		if (this.interface) {
			if (this.summary.failed.length > 0) {
				const content = DOM.create('p', {
					textContent: `${this.summary.failed.length} titles were not exported or had an error while exporting.`,
				});
				this.interface.message('warning', [content]);
				const failedBlock = this.summaryFailBlock(content);
				for (const title of this.summary.failed) {
					const name = title.name ?? '[No Name]';
					const row = DOM.create('li', {
						childs: [
							DOM.create('a', {
								target: '_blank',
								href: MangaDex.link(title.key),
								childs: [
									DOM.create('img', { src: Extension.icon(ServiceKey.MangaDex), title: 'MangaDex' }),
									DOM.space(),
									DOM.text(name),
									DOM.space(),
									DOM.icon('external-link-alt'),
								],
								title: 'Open in new tab',
							}),
						],
					});
					if (title.services && title.services[this.service.key]) {
						DOM.append(
							row,
							DOM.space(),
							DOM.text('('),
							DOM.create('a', {
								target: '_blank',
								href: this.service.link(title.services[this.service.key]!),
								childs: [
									DOM.create('img', { src: Extension.icon(this.service.key), title: 'MangaDex' }),
									DOM.space(),
									DOM.text(name),
									DOM.space(),
									DOM.icon('external-link-alt'),
								],
								title: 'Open in new tab',
							}),
							DOM.text(')')
						);
					}
					failedBlock.appendChild(row);
				}
			}
			this.interface.message('success', `Exported ${this.summary.valid} titles in ${this.summary.totalTime()} !`);
		}
	};

	selectTitles = (titles: TitleCollection): LocalTitle[] => {
		const filtered: LocalTitle[] = [];
		for (const title of titles) {
			if (title.status !== Status.NONE && title.services[this.service.key] !== undefined) {
				filtered.push(title);
			}
		}
		return filtered;
	};

	run = async (): Promise<ModuleStatus> => {
		// Reset
		this.summary = new Summary();

		try {
			// Check login status
			const loginMessage = this.interface?.message('loading', 'Checking login status...');
			if ((await this.service.loggedIn()) !== ResponseStatus.SUCCESS) {
				loginMessage?.classList.remove('loading');
				this.interface?.message('error', `Exporting need you to be logged in on ${this.service.name} !`);
				this.interface?.complete();
				return ModuleStatus.LOGIN_FAIL;
			}
			loginMessage?.classList.remove('loading');

			// Select Titles
			const titles: TitleCollection = await TitleCollection.get();
			const filteredTitles: LocalTitle[] = this.selectTitles(titles);
			if (this.preExecute && !(await this.preExecute(filteredTitles))) {
				this.interface?.complete();
				return ModuleStatus.PREXECUTE_FAIL;
			}

			// Check Mochi
			this.setOptions();
			if (this.options.mochi.active) {
				const titles: TitleCollection = await TitleCollection.get();
				let current = 0;
				let progress = DOM.create('p');
				const notification = this.interface?.message('loading', [progress]);
				const max = Math.ceil(titles.length / this.perConvert);
				for (let i = 0; !this.interface?.doStop && i < max; i++) {
					const titleList = titles.collection.slice(current, current + this.perConvert);
					current += this.perConvert;
					progress.textContent = `Finding ID for titles ${Math.min(
						titles.length,
						current + this.perConvert
					)} out of ${titles.length}.`;
					const connections = await Mochi.findMany(titleList.map((t) => t.key.id!));
					if (connections !== undefined) {
						for (const titleId in connections) {
							const id = parseInt(titleId);
							const title = titleList.find((t) => t.key.id! == id);
							if (title) Mochi.assign(title, connections[titleId]);
						}
					}
				}
				await titles.persist();
				notification?.classList.remove('loading');
			}
			if (this.interface?.doStop) {
				this.interface.message('warning', 'You cancelled the Export.');
				return ModuleStatus.CANCEL;
			}

			// Execute
			const result = await this.execute(filteredTitles);

			// Done
			if (this.interface?.doStop) this.interface.message('warning', 'You cancelled the Export.');
			this.displaySummary();
			this.interface?.complete();
			if (result && this.postExecute) await this.postExecute();
			return result ? ModuleStatus.SUCCESS : ModuleStatus.EXECUTE_FAIL;
		} catch (error) {
			const line = await log(error);
			if (line) this.interface?.message('error', line.msg);
			this.interface?.complete();
			return ModuleStatus.GENERAL_FAIL;
		}
	};
}

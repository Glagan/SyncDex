import { DOM } from './DOM';
import { ModuleInterface } from './ModuleInterface';
import { Service } from './Service';
import { FoundTitle, LocalTitle, TitleCollection } from './Title';
import { Mochi } from './Mochi';
import { LocalStorage } from './Storage';
import { Options } from './Options';

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
	service: typeof Service;
	interface?: ModuleInterface;
	summary: Summary;
	perConvert: number = 250;
	abstract options: ModuleOptions;

	extendOptions?(): void;

	constructor(service: typeof Service, moduleInterface?: ModuleInterface) {
		this.service = service;
		this.interface ??= moduleInterface;
		this.summary = new Summary();
	}

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
		const loggedIn = (await this.service.loggedIn()) === RequestStatus.SUCCESS;
		notification?.classList.remove('loading');
		return loggedIn;
	};

	setOptions = (): void => {
		for (const name in this.options) {
			this.options[name].active = this.options[name].default;
		}
		if (this.interface) {
			for (const name in this.options) {
				if (this.interface.form[name]) {
					this.options[name].active = this.interface.form[name].checked;
				}
			}
		}
	};

	abstract async run(): Promise<void>;

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

// TODO: Display cancel as separate from an error
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

	constructor(service: typeof Service, moduleInterface?: ModuleInterface) {
		super(service, moduleInterface);
		if (this.extendOptions) this.extendOptions();
		this.interface?.bind(this);
	}

	async preExecute?(): Promise<boolean>;
	abstract async execute(): Promise<boolean>;
	async postExecute?(): Promise<void>;

	displaySummary = (): void => {
		if (this.summary.total != this.summary.valid) {
			const content = DOM.create('p', {
				textContent: `${this.summary.failed.length} titles were not imported since they had invalid or missing properties.`,
			});
			this.interface?.message('warning', [content]);
			if (this.summary.failed.length > 0) {
				const failedBlock = this.summaryFailBlock(content);
				for (const title of this.summary.failed) {
					failedBlock.appendChild(
						DOM.create('li', {
							childs: [
								DOM.create('a', {
									target: '_blank',
									href: this.service.link(title.key),
									textContent: title.name ?? '[No Name]',
									childs: [DOM.space(), DOM.icon('external-link-alt')],
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
		this.interface?.message('success', report);
	};

	run = async (): Promise<void> => {
		// Reset
		this.summary = new Summary();
		this.found = [];

		// Check login status
		const loginMessage = this.interface?.message('loading', 'Checking login status...');
		if ((await this.service.loggedIn()) !== RequestStatus.SUCCESS) {
			loginMessage?.classList.remove('loading');
			this.interface?.message('error', `Importing need you to be logged in on ${this.service.serviceName} !`);
			this.interface?.complete();
			return;
		}
		loginMessage?.classList.remove('loading');
		if (this.preExecute) {
			if (!(await this.preExecute())) return;
		}

		// Execute
		this.setOptions();
		const result = await this.execute();
		if (!result) {
			this.interface?.complete();
			return;
		}
		this.interface?.message('default', `Found ${this.found.length} Titles on ${this.service.serviceName}.`);
		this.summary.total = this.found.length;

		// Find MangaDex ID for all FoundTitle
		const titles: TitleCollection = await TitleCollection.get();
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
				titleList.map((t) => t.mochi),
				this.service.serviceName
			);
			const found: (number | string)[] = [];
			if (allConnections !== undefined) {
				for (const key in allConnections) {
					const connections = allConnections[key];
					if (connections['md'] !== undefined) {
						const title = titleList.find((t) => t.mochi == key);
						if (title) {
							const localTitle = new LocalTitle(connections['md'], title);
							Mochi.assign(localTitle, connections);
							localTitle.services[this.service.key] = title.key;
							titles.add(localTitle);
							this.summary.valid++;
							found.push(title.mochi);
						}
					}
				}
			}
			// Add missing titles to the failed Summary
			this.summary.failed.push(...titleList.filter((t) => found.indexOf(t.mochi) < 0));
		}
		notification?.classList.remove('loading');

		// Merge
		if (!this.options.merge.active) {
			if (this.options.save.active) await LocalStorage.clear();
			await Options.save();
		} else if (titles.length > 0) {
			titles.merge(await TitleCollection.get(titles.ids));
		}

		// Add chapters
		if (Options.saveOpenedChapters) {
			for (const title of titles.collection) {
				if (title.progress.chapter > 0) {
					title.chapters = [];
					let index = Math.max(title.progress.chapter - Options.chaptersSaved, 1);
					for (; index <= title.progress.chapter; index++) {
						title.chapters.push(index);
					}
				}
			}
		}

		if (this.options.save.active) await titles.persist();
		this.displaySummary();
		this.interface?.complete();
		if (this.postExecute) await this.postExecute();
	};
}

// TODO: Display cancel as separate from an error
export abstract class ExportModule extends Module {
	options: ModuleOptions = {
		mochi: {
			description: 'Check Services ID with Mochi after Import',
			display: true,
			default: true,
		},
	};

	constructor(service: typeof Service, moduleInterface?: ModuleInterface) {
		super(service, moduleInterface);
		if (this.extendOptions) this.extendOptions();
		this.interface?.bind(this);
	}

	async preExecute?(filtered: LocalTitle[]): Promise<boolean>;
	abstract async execute(filtered: LocalTitle[]): Promise<boolean>;
	async postExecute?(): Promise<void>;

	displaySummary = (): void => {
		if (this.summary.total != this.summary.valid) {
			const content = DOM.create('p', {
				textContent: `${this.summary.failed.length} titles were not exported since they had invalid or missing properties.`,
			});
			this.interface?.message('warning', [content]);
			if (this.summary.failed.length > 0) {
				const failedBlock = this.summaryFailBlock(content);
				for (const title of this.summary.failed) {
					failedBlock.appendChild(
						DOM.create('li', {
							childs: [
								DOM.create('a', {
									target: '_blank',
									href: LocalTitle.link(title.key),
									textContent: title.name ?? '[No Name]',
									childs: [DOM.space(), DOM.icon('external-link-alt')],
									title: 'Open in new tab',
								}),
							],
						})
					);
				}
			}
		}
		this.interface?.message('success', `Exported ${this.summary.valid} titles in ${this.summary.totalTime()} !`);
	};

	selectTitles = (titles: TitleCollection): LocalTitle[] => {
		const filtered: LocalTitle[] = [];
		for (const title of titles.collection) {
			if (title.services[this.service.key] !== undefined) {
				filtered.push(title);
			}
		}
		return filtered;
	};

	run = async (): Promise<void> => {
		// Reset
		this.summary = new Summary();

		// Check login status
		const loginMessage = this.interface?.message('loading', 'Checking login status...');
		if ((await this.service.loggedIn()) !== RequestStatus.SUCCESS) {
			loginMessage?.classList.remove('loading');
			this.interface?.message('error', `Exporting need you to be logged in on ${this.service.serviceName} !`);
			this.interface?.complete();
			return;
		}
		loginMessage?.classList.remove('loading');

		// Select Titles
		const titles: TitleCollection = await TitleCollection.get();
		const filteredTitles: LocalTitle[] = this.selectTitles(titles);
		if (this.preExecute && !(await this.preExecute(filteredTitles))) {
			this.interface?.complete();
			return;
		}

		// Check Mochi
		this.setOptions();
		if (this.options.mochi.active) {
			const titles: TitleCollection = await TitleCollection.get();
			let current = 0;
			let progress = DOM.create('p');
			const notification = this.interface?.message('loading', [progress]);
			const max = Math.ceil(this.summary.total / this.perConvert);
			for (let i = 0; !this.interface?.doStop && i < max; i++) {
				const titleList = titles.collection.slice(current, current + this.perConvert);
				current += this.perConvert;
				progress.textContent = `Finding ID for titles ${Math.min(
					max,
					current + this.perConvert
				)} out of ${max}.`;
				const connections = await Mochi.findMany(titleList.map((t) => t.key.id!));
				if (connections !== undefined) {
					for (const titleId in connections) {
						const id = parseInt(titleId);
						const title = titleList.find((t) => t.key.id! == id);
						if (title) Mochi.assign(title, connections[titleId]);
					}
				}
			}
			notification?.classList.remove('loading');
			if (this.interface?.doStop) return this.interface?.complete();
		}

		// Execute
		const result = await this.execute(filteredTitles);
		if (!result) {
			this.interface?.complete();
			return;
		}

		this.displaySummary();
		if (this.postExecute) await this.postExecute();
	};
}

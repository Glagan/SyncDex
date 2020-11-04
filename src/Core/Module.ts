import { DOM } from './DOM';
import { ModuleInterface } from './ModuleInterface';
import { Service } from './Service';
import { FoundTitle, LocalTitle, TitleCollection } from './Title';
import { Mochi } from './Mochi';

/**
 * Convert a duration in ms to a string
 */
export function duration(time: number): string {
	if (time == 0) return '0s';
	const diff = Math.floor(time) / 1000;
	let r = [];
	let p: Partial<Record<'hours' | 'mins' | 'sec', number>> = {};
	if ((p.hours = Math.floor((diff % 86400) / 3600)) > 0) r.push(p.hours, `hour${p.hours > 1 ? 's' : ''} `);
	if ((p.mins = Math.floor((diff % 3600) / 60)) > 0) r.push(p.mins, `minute${p.mins > 1 ? 's' : ''} `);
	if ((p.sec = Math.floor(diff % 60)) > 0) r.push(p.sec, 's ');
	return r.join('').trim();
}

export class Summary {
	total: number = 0;
	valid: number = 0;
	failed: string[] = [];
	startTime: number = 0;
	options: number = 0;
	history: boolean = false;

	start = (): void => {
		this.startTime = Date.now();
	};

	totalTime = (): string => {
		return duration(Date.now() - this.startTime);
	};
}

export interface ModuleOptions {
	merge: boolean;
	mochi: boolean;
}

/**
 * Abstract Module with a simple single `execute` function that need to be written.
 * An optionnal ModuleInterface can be provided and need to be checked before calling it in `execute`.
 */
export abstract class Module {
	service: typeof Service;
	interface?: ModuleInterface;
	summary: Summary;
	requireLogin: boolean = false;
	perConvert = 250;

	constructor(service: typeof Service, moduleInterface?: ModuleInterface) {
		this.service = service;
		this.interface ??= moduleInterface;
		this.summary = new Summary();
	}

	checkCancel = (): boolean => {
		return !!this.interface?.doStop;
	};

	checkLogin = async (): Promise<boolean> => {
		const notification = this.interface?.message('loading', 'Checking login status...');
		const loggedIn = (await this.service.loggedIn()) === RequestStatus.SUCCESS;
		notification?.classList.remove('loading');
		return loggedIn;
	};

	abstract async doExecute(): Promise<void>;

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
	async preExecute?(): Promise<boolean>;
	abstract async execute(options: ModuleOptions): Promise<boolean | FoundTitle[]>;
	async postExecute?(): Promise<void>;

	doExecute = async (): Promise<void> => {
		// Reset
		this.summary = new Summary();

		// Check login status
		if (this.requireLogin && (await this.service.loggedIn()) !== RequestStatus.SUCCESS) {
			this.interface?.message('error', `Importing need you to be logged in on ${this.service.serviceName} !`);
			this.interface?.complete();
			return;
		}
		if (this.preExecute) {
			if (!(await this.preExecute())) return;
		}

		// Find Options
		const options = { merge: true, mochi: true };
		if (this.interface) {
			options.merge = this.interface.form.merge.checked;
			options.mochi = this.interface.form.mochi.checked;
		}

		// Execute
		const medias: FoundTitle[] | boolean = await this.execute(options);
		if (typeof medias === 'boolean') {
			this.interface?.complete();
			return;
		}

		// Find MangaDex ID for all FoundTitle
		const titles: TitleCollection = await TitleCollection.get();
		let current = 0;
		let progress = DOM.create('p');
		const notification = this.interface?.message('loading', [progress]);
		const max = Math.ceil(this.summary.total / this.perConvert);
		for (let i = 0; !this.interface?.doStop && i < max; i++) {
			const titleList = medias.slice(current, current + this.perConvert);
			current += this.perConvert;
			progress.textContent = `Converting title ${Math.min(max, current + this.perConvert)} out of ${max}.`;
			const connections = await Mochi.findMany(
				titleList.map((t) => t.mochi),
				this.service.serviceName
			);
			const found: (number | string)[] = [];
			if (connections !== undefined) {
				for (const key in connections) {
					const connection = connections[key];
					if (connection['md'] !== undefined) {
						const title = titleList.find((t) => t.mochi == key);
						if (title) {
							titles.add(new LocalTitle(connection['md'], title));
							this.summary.valid++;
							found.push(title.mochi);
						}
					}
				}
			}
			// Add missing titles to the failed Summary
			const noIds = titleList.filter((t) => found.indexOf(t.mochi) < 0);
			this.summary.failed.push(...noIds.filter((t) => t.name !== undefined).map((t) => t.name as string));
		}
		notification?.classList.remove('loading');

		if (this.postExecute) await this.postExecute();
	};
}

export abstract class ExportModule extends Module {
	async preExecute?(filtered: LocalTitle[]): Promise<boolean>;
	abstract async execute(filtered: LocalTitle[], options: ModuleOptions): Promise<boolean>;
	async postExecute?(): Promise<void>;

	selectTitles = (titles: TitleCollection): LocalTitle[] => {
		const filtered: LocalTitle[] = [];
		for (const title of titles.collection) {
			if (title.services[this.service.key] !== undefined) {
				filtered.push(title);
			}
		}
		return filtered;
	};

	doExecute = async (): Promise<void> => {
		// Reset
		this.summary = new Summary();

		// Check login status
		if (this.requireLogin && (await this.service.loggedIn()) !== RequestStatus.SUCCESS) {
			this.interface?.message('error', `Exporting need you to be logged in on ${this.service.serviceName} !`);
			this.interface?.complete();
			return;
		}

		// Select Titles
		const titles: TitleCollection = await TitleCollection.get();
		const filteredTitles: LocalTitle[] = this.selectTitles(titles);
		if (this.preExecute && !(await this.preExecute(filteredTitles))) {
			this.interface?.complete();
			return;
		}

		// Find Options
		const options = { merge: true, mochi: true };
		if (this.interface) {
			options.merge = this.interface.form.merge.checked;
			options.mochi = this.interface.form.mochi.checked;
		}

		// Check Mochi
		if (options.mochi) {
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
		const result: boolean = await this.execute(filteredTitles, options);
		if (!result) {
			this.interface?.complete();
			return;
		}

		if (this.postExecute) await this.postExecute();
	};
}

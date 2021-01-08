import { LocalStorage } from './Storage';

export class History {
	static last?: number;
	static page?: number;
	static ids: number[] = [];

	static find(id: number): number {
		return History.ids.indexOf(id);
	}

	static add(id: number) {
		const index = History.find(id);
		if (index > 0) History.ids.splice(index, 1);
		History.ids.unshift(id);
	}

	static async load(): Promise<void> {
		const history = await LocalStorage.get('history');
		if (history == undefined) {
			await LocalStorage.set('history', { ids: [] });
		} else {
			History.last = history.last;
			History.page = history.page;
			History.ids = history.ids;
		}
	}

	static async save(): Promise<void> {
		await LocalStorage.set('history', {
			last: History.last,
			page: History.page,
			ids: History.ids,
		});
	}
}

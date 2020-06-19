import { Runtime, JSONResponse } from './Runtime';
import { ServiceName } from './Service/Service';

interface MochiResult {
	data: Record<MochiService, number>;
	meta: {
		time: Record<string, number>;
	} & Record<string, any>;
}

interface MochiManyResult {
	data: Record<MochiService, number>[];
	meta: {
		time: Record<string, number>;
	} & Record<string, any>;
}

enum MochiService {
	MangaDex = 'MangaDex',
	MyAnimeList = 'MyAnimeList',
	Anilist = 'Anilist',
	Kitsu = 'Kitsu',
	MangaUpdates = 'MangaUpdates',
	AnimePlanet = 'AnimePlanet',
}

export class Mochi {
	static server: string = 'http://localhost/mochi-v2/api';

	static link(route: string): string {
		return `${Mochi.server}${route}`;
	}

	/**
	 * Return an array with all the connections of a single Title from any Service
	 * @param title ID of the Title on the service
	 * @param service The service of the Title
	 */
	static async find(
		title: number | string,
		service: ServiceName = ServiceName.MangaDex
	): Promise<Record<MochiService, number> | undefined> {
		const response = await Runtime.request<JSONResponse>({
			url: `${Mochi.server}/connections.php?id=${title}&service=${service}`,
			isJson: true,
		});
		if (response.status >= 400) {
			return undefined;
		}
		return (response.body as MochiResult).data;
	}

	static async findMany(
		title: number[] | string[],
		service: ServiceName = ServiceName.MangaDex
	): Promise<Record<MochiService, number>[] | undefined> {
		const response = await Runtime.request<JSONResponse>({
			url: `${Mochi.server}/batch.php?id=${title.join(',')}&service=${service}`,
			isJson: true,
		});
		if (response.status >= 400) {
			return undefined;
		}
		return (response.body as MochiManyResult).data;
	}
}

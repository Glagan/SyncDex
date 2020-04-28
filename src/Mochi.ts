import { Runtime, JSONResponse } from './Runtime';

interface MochiResult {
	data: Record<MochiService, string | number>;
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
		service: string = 'MangaDex'
	): Promise<Record<MochiService, string | number> | undefined> {
		const response = await Runtime.request<JSONResponse>({
			url: `${Mochi.server}/connections.php?id=${title}&service=${service}`,
			isJson: true,
		});
		if (response.status >= 400) {
			return undefined;
		}
		return (response.body as MochiResult).data;
	}
}

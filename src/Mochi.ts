import { Runtime } from './Runtime';
import { ServiceName } from './core';

type MochiConnections = {
	[key in ServiceName]: number;
};

interface MochiResult {
	data: MochiConnections[];
	meta: {
		time: Record<string, number>;
	} & Record<string, any>;
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
		source: ServiceName = ServiceName.MangaDex
	): Promise<MochiConnections | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: `${Mochi.server}/connections.php?id=${title}&source=${source}`,
		});
		if (response.status >= 400) return undefined;
		if (response.body.data === undefined) return undefined;
		return response.body.data[+title];
	}

	static async findMany(
		title: (number | string)[],
		source: ServiceName = ServiceName.MangaDex
	): Promise<MochiConnections[] | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: `${Mochi.server}/connections.php?id=${title.join(',')}&source=${source}`,
		});
		if (response.status >= 400) return undefined;
		return response.body.data;
	}
}

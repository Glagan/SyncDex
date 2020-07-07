import { Runtime } from './Runtime';
import { ServiceName, ServiceKeyMap, ServiceList } from './Title';

interface MochiResult {
	data: ServiceList[];
	meta: {
		time: Record<string, number>;
	} & Record<string, any>;
}

/**
 * Wrapper for the Mochi API.
 */
export class Mochi {
	static server: string = 'http://localhost/mochi-v2/api';

	/**
	 * Create link to the `Connections` endpoint.
	 */
	static connections(
		id: (number | string) | (number | string)[],
		source: ServiceName = ServiceName.MangaDex
	): string {
		if (Array.isArray(id)) return `${Mochi.server}/connections.php?id=${id.join(',')}&source=${source}`;
		return `${Mochi.server}/connections.php?id=${id}&source=${source}`;
	}

	/**
	 * Return all connections of a Media.
	 * @param title ID of the Title on the service
	 * @param source The service of the Title
	 */
	static async find(
		title: number | string,
		source: ServiceName = ServiceName.MangaDex
	): Promise<ServiceList | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: Mochi.connections(title, source),
		});
		if (!response.ok) return undefined;
		if (response.body.data === undefined) return undefined;
		return response.body.data[+title];
	}

	/**
	 * Return all connections for all listed Medias.
	 * @param title ID of the Title on the service
	 * @param source The service of the Title
	 */
	static async findMany(
		title: (number | string)[],
		source: ServiceName = ServiceName.MangaDex
	): Promise<ServiceList[] | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: Mochi.connections(title, source),
		});
		if (!response.ok) return undefined;
		return response.body.data;
	}
}

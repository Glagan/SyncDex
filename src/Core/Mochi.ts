import { Runtime } from './Runtime';
import { ActivableKey, ServiceList, ServiceName, StaticKey } from './Service';
import { LocalTitle } from './Title';

interface MochiService extends ServiceList {
	[StaticKey.MangaDex]?: number;
}

interface MochiResult {
	data: MochiService[];
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
	 * @param id ID of the Title on the service
	 * @param source The service of the Title
	 */
	static async find(
		id: number | string,
		source: ServiceName = ServiceName.MangaDex
	): Promise<MochiService | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: Mochi.connections(id, source),
		});
		if (!response.ok) return undefined;
		if (response.body.data === undefined) return undefined;
		return response.body.data[+id];
	}

	/**
	 * Return all connections for all listed Medias.
	 * @param ids IDs of the Title on the service
	 * @param source The service of the Title
	 */
	static async findMany(
		ids: (number | string)[],
		source: ServiceName = ServiceName.MangaDex
	): Promise<MochiService[] | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: Mochi.connections(ids, source),
		});
		if (!response.ok) return undefined;
		return response.body.data;
	}

	/**
	 * Assign connections found from Mochi to a Title.
	 */
	static assign(title: LocalTitle, connections: ServiceList): void {
		for (const key in connections) {
			const serviceKey = key as ActivableKey;
			Object.assign(title.services, {
				[serviceKey]: connections[serviceKey],
			});
		}
	}
}

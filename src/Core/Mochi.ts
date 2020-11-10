import { Runtime } from './Runtime';
import { ServiceName, StaticKey } from './Service';
import { LocalTitle, SaveServiceList } from './Title';

export interface MochiExtra {
	names?: boolean;
}

interface MochiService extends SaveServiceList {
	name?: string;
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
		source: ServiceName = ServiceName.MangaDex,
		extra?: MochiExtra
	): string {
		const extras = extra
			? `&${Object.keys(extra)
					.map((key) => `${key}=${extra[key as keyof MochiExtra]}`)
					.join('&')}`
			: '';
		if (Array.isArray(id)) return `${Mochi.server}/connections.php?id=${id.join(',')}&source=${source}${extras}`;
		return `${Mochi.server}/connections.php?id=${id}&source=${source}${extras}`;
	}

	/**
	 * Return all connections of a Media.
	 * @param id ID of the Title on the service
	 * @param source The service of the Title
	 */
	static async find(
		id: number | string,
		source: ServiceName = ServiceName.MangaDex,
		extra?: MochiExtra
	): Promise<MochiService | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: Mochi.connections(id, source, extra),
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
		source: ServiceName = ServiceName.MangaDex,
		extra?: MochiExtra
	): Promise<MochiService[] | undefined> {
		const response = await Runtime.jsonRequest<MochiResult>({
			url: Mochi.connections(ids, source, extra),
		});
		if (!response.ok) return undefined;
		return response.body.data;
	}

	/**
	 * Assign connections found from Mochi to a Title.
	 */
	static assign(title: LocalTitle, connections: MochiService): void {
		for (const key in connections) {
			const serviceKey = key as keyof MochiService;
			const mediaKey = connections[serviceKey]!;
			if (serviceKey == StaticKey.MangaDex) {
				if (typeof mediaKey === 'number') title.key.id = mediaKey as number;
			} else if (serviceKey == 'name') {
				title.name = mediaKey as string;
			} else {
				if (typeof mediaKey === 'number') {
					title.services[serviceKey] = { id: mediaKey };
				} else if (typeof mediaKey !== 'string') {
					title.services[serviceKey] = {} as MediaKey;
					if (mediaKey.i) title.services[serviceKey]!.id = mediaKey.i;
					if (mediaKey.s) title.services[serviceKey]!.slug = mediaKey.s;
					if (
						title.services[serviceKey]!.id === undefined &&
						title.services[serviceKey]!.slug === undefined
					) {
						delete title.services[serviceKey];
					}
				}
			}
		}
	}
}

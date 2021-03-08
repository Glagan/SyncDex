import { LocalTitle } from './Title';
import { ServiceKey } from '../Service/Keys';
import { ServiceName } from '../Service/Names';
import { log } from './Log';
import { Http } from './Http';

interface ComplexType {
	bar: boolean;
	baz: string;
}

type Foo = {
	[key: string]: ComplexType;
} & Partial<{
	foo: ComplexType;
	bar: boolean;
	baz: number;
}>;

function get<T extends Foo, K extends keyof T>(keys: K[]): Partial<{ [key in K]: T[key] }> {
	return {};
}

const t = get(['bar', 'baz', 'foo']);

export interface MochiExtra {
	names?: boolean;
}

interface MochiService extends SaveServiceList {
	name?: string;
	[ServiceKey.MangaDex]?: number;
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
	static server: string = 'https://mochi.nikurasu.org';

	static makeExtras(extra?: MochiExtra): string {
		return extra
			? `&${Object.keys(extra)
					.map((key) => `${key}=${extra[key as keyof MochiExtra]}`)
					.join('&')}`
			: '';
	}

	/**
	 * Create link to the `Connections` endpoint.
	 */
	static connections(
		id: (number | string) | (number | string)[],
		source: ServiceName = ServiceName.MangaDex,
		extra?: MochiExtra
	): string {
		// const extras = Mochi.makeExtras(extra);
		if (Array.isArray(id)) return `${Mochi.server}/connections/${source}/${id.join(',')}`;
		return `${Mochi.server}/connections/${source}/${id}`;
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
		const response = await Http.json<MochiResult>(Mochi.connections(id, source, extra), {
			method: 'GET',
			headers: { Accept: 'application/json' },
		});
		if (!response.ok || !response.body) {
			await log(
				`Mochi error: code ${response.code ?? 0} body ${
					typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
				}`
			);
			return undefined;
		}
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
		const response = await Http.json<MochiResult>(Mochi.connections(ids, source, extra), { method: 'GET' });
		if (!response.ok || !response.body) {
			await log(
				`Mochi error: code ${response.code} body ${
					typeof response.body === 'string' ? response.body : JSON.stringify(response.body)
				}`
			);
			return undefined;
		}
		return response.body.data;
	}

	/**
	 * Assign connections found from Mochi to a Title.
	 */
	static assign(title: LocalTitle, connections: MochiService): void {
		for (const key in connections) {
			const serviceKey = key as keyof MochiService;
			const mediaKey = connections[serviceKey]!;
			if (serviceKey == ServiceKey.MangaDex) {
				if (typeof mediaKey === 'number') title.key.id = mediaKey as number;
			} else if (serviceKey == 'name') {
				title.name = mediaKey as string;
			} else if (!title.doForceService(serviceKey)) {
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

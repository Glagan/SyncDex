import { ServiceTitle, Title } from '../Title';
import { RequestStatus, Runtime } from '../Runtime';

export class MangaDexTitle extends ServiceTitle<MangaDexTitle> {
	readonly serviceName: ServiceName = 'MangaDex';
	readonly serviceKey: ServiceKey = 'md';

	static link(id: number): string {
		return `https://mangadex.org/title/${id}`;
	}

	id: number;
	status: Status;
	// TODO: Add Services

	constructor(id: number, title?: Partial<MangaDexTitle>) {
		super(title);
		this.id = id;
		this.status = title && title.status !== undefined ? title.status : Status.NONE;
	}

	static get = async (id: number): Promise<RequestStatus> => {
		// TODO
		return RequestStatus.FAIL;
	};

	persist = async (): Promise<RequestStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${this.id}&type=${
				this.status
			}&_=${Date.now()}`,
			credentials: 'include',
			headers: {
				'X-Requested-With': 'XMLHttpRequest',
			},
		});
		// TODO: Add Score
		return Runtime.responseStatus(response);
	};

	delete = async (): Promise<RequestStatus> => {
		// TODO
		return RequestStatus.FAIL;
	};

	toTitle = (): Title | undefined => {
		return new Title(this.id as number, {
			progress: this.progress,
			status: this.status,
			score: this.score !== undefined && this.score > 0 ? this.score : undefined,
			name: this.name,
		});
	};

	static fromTitle = (title: Title): MangaDexTitle | undefined => {
		if (!title.id) return undefined;
		return new MangaDexTitle(title.id, {
			progress: title.progress,
			status: title.status,
			score: title.score,
			name: title.name,
		});
	};

	get mochi(): number {
		return this.id;
	}
}

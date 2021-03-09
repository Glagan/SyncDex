export type MangaDexAPIEndpoint =
	| 'get:user:me'
	| 'get:user:title'
	| 'get:user:followed:list'
	| 'get:user:followed:updates'
	| 'get:title'
	| 'set:title:status'
	| 'set:title:unfollow'
	| 'set:title:rating'
	| 'update:title:progress'
	| 'update:title:incrementChapter'
	| 'update:title:incrementVolume';

type ThumbnailSize = 'thumb' | 'large' | 'original';

export namespace MangaDex {
	export function link(key: MediaKey): string {
		return `https://mangadex.org/title/${key.id}`;
	}

	export function thumbnail(key: MediaKey, size: ThumbnailSize = 'original', extension: string = 'jpg'): string {
		return `https://mangadex.org/images/manga/${key.id}${size != 'original' ? `.${size}` : ''}.${extension}`;
	}

	const MangaDexAPI = 'https://api.mangadex.org/v2';

	export function api(type: 'get:user:me'): string;
	export function api(type: 'get:user:title', id: number): string;
	export function api(type: 'get:user:followed:list'): string;
	export function api(type: 'get:user:followed:updates', page: number): string;
	export function api(type: 'get:title', id: number, include?: { chapters: boolean }): string;
	export function api(type: 'set:title:status', id: number, status: Status): string;
	export function api(type: 'set:title:unfollow', id: number): string;
	export function api(type: 'set:title:rating', id: number, rating: number): string;
	export function api(type: 'update:title:progress', id: number): string;
	export function api(type: 'update:title:incrementChapter', id: number): string;
	export function api(type: 'update:title:incrementVolume', id: number): string;
	export function api(type: MangaDexAPIEndpoint, ...args: any[]): string {
		switch (type) {
			case 'get:user:me':
				return `${MangaDexAPI}/user/me`;
			case 'get:user:title':
				return `${MangaDexAPI}/user/me/manga/${args[0]}`;
			case 'get:title':
				return `${MangaDexAPI}/manga/${args[0]}${args[1] && args[1].chapters ? '?include=chapters' : ''}`;
			case 'get:user:followed:list':
				return `${MangaDexAPI}/user/me/followed-manga?hentai=1`;
			case 'get:user:followed:updates':
				return `${MangaDexAPI}/user/me/followed-updates?type=1&hentai=1&p=${args[0]}`;
			case 'set:title:status':
				return `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${args[0]}&type=${
					args[1]
				}&_=${Date.now()}`;
			case 'set:title:unfollow':
				return `https://mangadex.org/ajax/actions.ajax.php?function=manga_unfollow&id=${args[0]}&type=${
					args[0]
				}&_=${Date.now()}`;
			case 'set:title:rating':
				return `https://mangadex.org/ajax/actions.ajax.php?function=manga_rating&id=${args[0]}&rating=${
					args[1]
				}&_=${Date.now()}`;
			case 'update:title:progress':
				return `https://mangadex.org/ajax/actions.ajax.php?function=edit_progress&id=${args[0]}`;
			case 'update:title:incrementChapter':
				return `https://mangadex.org/ajax/actions.ajax.php?function=increment_chapter&id=${
					args[0]
				}&_=${Date.now()}`;
			case 'update:title:incrementVolume':
				return `https://mangadex.org/ajax/actions.ajax.php?function=increment_volume&id=${
					args[0]
				}&_=${Date.now()}`;
		}
	}

	/**
	 * Build a full URL to interact with the MangaDex API with the instance LocalTitle.
	 */
	export function list(field: MangaDexTitleField, id: number, state: MangaDexState): string {
		switch (field) {
			case 'unfollow':
				return MangaDex.api('set:title:unfollow', id);
			case 'status':
				return MangaDex.api('set:title:status', id, state.status);
			case 'rating':
				return MangaDex.api('set:title:rating', id, Math.round(state.rating! / 10));
			case 'progress':
				return MangaDex.api('update:title:progress', id);
		}
	}
}

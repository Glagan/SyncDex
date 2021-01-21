export type MangaDexAPIEndpoint =
	| 'me'
	| 'userTitle'
	| 'title'
	| 'followed'
	| 'update'
	| 'unfollow'
	| 'rating'
	| 'updates';

type ThumbnailSize = 'thumb' | 'large' | 'original';

export namespace MangaDex {
	export function link(key: MediaKey): string {
		return `https://mangadex.org/title/${key.id}`;
	}

	export function thumbnail(key: MediaKey, size: ThumbnailSize = 'original', extension: string = 'jpg'): string {
		return `https://mangadex.org/images/manga/${key.id}${size != 'original' ? `.${size}` : ''}.${extension}`;
	}

	// const MangaDexAPI = 'https://api.mangadex.org/v2';
	const MangaDexAPI = 'https://mangadex.org/api/v2';

	export function api(type: 'me'): string;
	export function api(type: 'title', id: number, include?: { chapters: boolean }): string;
	export function api(type: 'userTitle', id: number): string;
	export function api(type: 'followed'): string;
	export function api(type: 'update', id: number, status: Status): string;
	export function api(type: 'unfollow', id: number): string;
	export function api(type: 'rating', id: number, rating: number): string;
	export function api(type: 'updates', page: number): string;
	export function api(type: MangaDexAPIEndpoint, ...args: any[]): string {
		switch (type) {
			case 'me':
				return `${MangaDexAPI}/user/me`;
			case 'title':
				return `${MangaDexAPI}/manga/${args[0]}${args[1] && args[1].chapters ? '?include=chapters' : ''}`;
			case 'userTitle':
				return `${MangaDexAPI}/user/me/manga/${args[0]}`;
			case 'followed':
				return `${MangaDexAPI}/user/me/followed-manga`;
			case 'update':
				return `https://mangadex.org/ajax/actions.ajax.php?function=manga_follow&id=${args[0]}&type=${
					args[1]
				}&_=${Date.now()}`;
			case 'unfollow':
				return `https://mangadex.org/ajax/actions.ajax.php?function=manga_unfollow&id=${args[0]}&type=${
					args[0]
				}&_=${Date.now()}`;
			case 'rating':
				return `https://mangadex.org/ajax/actions.ajax.php?function=manga_rating&id=${args[0]}&rating=${
					args[1]
				}&_=${Date.now()}`;
			case 'updates':
				return `${MangaDexAPI}/user/me/followed-updates?type=1&p=${args[0]}`;
		}
	}
}
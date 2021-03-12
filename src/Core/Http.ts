import { browser, Tabs } from 'webextension-polyfill-ts';
import { loadLogs, log } from './Log';
import { Message } from './Message';
import { Storage } from '../Core/Storage';

/// @ts-ignore
const isChrome = window.chrome && window.browser === undefined;

async function getCleanSave() {
	const save = await Storage.get();
	if (save.options?.tokens) save.options.tokens = {};
	delete save.dropboxState;
	delete save.googleDriveState;
	delete save.saveSync;
	delete save.saveSyncInProgress;
	delete save.importInProgress;
	delete save.logs;
	return save;
}

export class Http {
	private static DEFAULT_COOLDOWN = 1250;
	private static cooldowns: Record<string, number> = {
		'mangadex.org': 1500,
		'myanimelist.net': 1500,
		'anilist.co': 1500,
		'nikurasu.org': 500,
	};
	private static apiRateLimit: { [key: string]: APIRateLimit } = {};
	private static cookieDomains = ['myanimelist.net', 'mangadex.org', 'mangaupdates.com', 'anime-planet.com'];
	private static lastRequest: Record<string, number> = {};
	private static findDomain(url: string): string {
		// Simple domain search - not the best but simple
		const res = /https?:\/\/(?:.+\.)?([-\w\d]+\.(?:\w{2,5}))(?:$|\/)/i.exec(url);
		if (res !== null) {
			return res[1];
		}
		return '*';
	}

	static sendRequest(request: HttpRequest, tab?: Tabs.Tab): Promise<HttpResponse> {
		return new Promise(async (resolve) => {
			// Cooldown
			const domain = Http.findDomain(request.url);
			const now = Date.now();

			// Sleep until cooldown is reached
			const cooldown = Http.cooldowns[domain] ?? Http.DEFAULT_COOLDOWN;
			if (Http.lastRequest[domain] && Http.lastRequest[domain] + cooldown >= now) {
				const diff = Http.lastRequest[domain] + cooldown - now;
				await new Promise((resolve) => setTimeout(resolve, diff));
			}
			Http.lastRequest[domain] = now + 50;

			// Check Rate Limit
			if (this.apiRateLimit[domain]) {
				const rateLimit = this.apiRateLimit[domain];

				// Sleep until Retry-After seconds
				if (rateLimit.retry) {
					await new Promise((resolve) => setTimeout(resolve, rateLimit.retry));
					delete rateLimit.retry;
				}
				// Add sleep time if the remaining rate limit is getting low
				else {
					const percentRemaining = rateLimit.remaining / rateLimit.limit;
					// If we used more than 50% of our rate limit
					// We will sleep at least 50% of the cooldown duration
					if (percentRemaining < 0.5) {
						// Sleep "cooldown * (1 - (percentRemaining * 1.5))" ms
						await new Promise((resolve) => setTimeout(resolve, cooldown * (1 - percentRemaining * 1.5)));
					}
				}
			}

			// Options
			const isJson = request.isJson === true;
			const init: RequestInit & { headers: Record<string, string> } = {
				method: request.method ?? 'GET',
				body: request.body ?? null,
				redirect: request.redirect ?? 'follow',
				cache: request.cache ?? 'default',
				mode: request.mode ?? undefined,
				referrer: request.referrer ?? undefined,
				credentials: request.credentials ?? 'same-origin',
				headers: ((<unknown>request.headers) as Record<string, string>) ?? {},
			};

			if (request.file !== undefined) {
				const save = await getCleanSave();
				if (request.file == 'namedLocalSave') {
					if (init.headers['Content-Type']) {
						delete init.headers['Content-Type'];
					}
					const body = new FormData();
					body.append(
						'Metadata',
						new File(
							[
								JSON.stringify({
									name: 'Save.json',
									mimeType: 'application/json',
									parents: ['appDataFolder'],
									modifiedTime: new Date().toISOString(),
								}),
							],
							'Metadata.json',
							{ type: 'application/json; charset=UTF-8' }
						)
					);
					body.append('Media', new File([JSON.stringify(save)], 'Save.json', { type: 'application/json' }));
					init.body = body;
				} else {
					if (init.headers['Content-Type'] === undefined) {
						init.headers['Content-Type'] = 'application/octet-stream';
					}
					init.body = new File([JSON.stringify(save)], 'application/json');
				}
			}
			// Convert FormData from an object since it can't be received as a Class
			else if (request.form !== undefined) {
				if (!(request.form instanceof FormData)) {
					const body = new FormData();
					for (const key in request.form as FormDataProxy) {
						if (request.form.hasOwnProperty(key)) {
							const element = request.form[key];
							if (typeof element === 'string') {
								body.set(key, element);
							} else if (typeof element === 'number') {
								body.set(key, element.toString());
							} else {
								body.set(key, new File(element.content, element.name, element.options));
							}
						}
					}
					init.body = body;
				}
			}

			// Get container cookies
			// Doesn't work on Chrome, cookieStoreId is static
			// Only find for sites which require cookies
			if (
				tab &&
				((!isChrome && init.credentials == 'same-origin') ||
					(init.credentials == 'include' && tab.cookieStoreId !== undefined)) &&
				Http.cookieDomains.indexOf(domain) >= 0
			) {
				const storeId = tab!.cookieStoreId;
				const cookiesList = await browser.cookies.getAll({ url: request.url, storeId });
				const cookies = cookiesList.map((c) => `${c.name}=${c.value}`).join('; ');
				if (cookies != '') init.headers['X-Cookie'] = cookies;
			}

			// Add X-Origin and X-Referer if needed
			// if (init.headers['Origin']) init.headers['X-Origin'] = init.headers['Origin'];
			// if (init.headers['Referer']) init.headers['X-Referer'] = init.headers['Referer'];

			resolve(
				await fetch(request.url, init)
					.then(async (response) => {
						// Save X-RateLimit-* headers for next request
						if (response.headers.has('X-RateLimit-Limit')) {
							if (!this.apiRateLimit[domain]) {
								this.apiRateLimit[domain] = {
									limit: parseInt(response.headers.get('X-RateLimit-Limit')!),
								} as APIRateLimit;
							}
							if (response.headers.has('X-RateLimit-Remaining')) {
								this.apiRateLimit[domain].remaining = parseInt(
									response.headers.get('X-RateLimit-Remaining')!
								);
								if (response.headers.has('Retry-After')) {
									this.apiRateLimit[domain].retry = parseInt(response.headers.get('Retry-After')!);
								}
							} else delete this.apiRateLimit[domain];
						}
						return <HttpResponse>{
							url: response.url,
							ok: response.status >= 200 && response.status < 400,
							status: Http.status(response.status),
							failed: false,
							code: response.status,
							redirected: response.redirected,
							// Chrome doesn't allow message with the Headers class
							headers: JSON.parse(JSON.stringify(response.headers)),
							body: isJson ? await response.json() : await response.text(),
						};
					})
					.catch(async (error) => {
						await loadLogs(true);
						log(`Error on request [${request.url}]: ${error}${error.stack ? `>> ${error.stack}` : ''}`);
						return <HttpResponse>{
							url: request.url,
							ok: false,
							status: ResponseStatus.FAIL,
							failed: true,
							code: 0,
							redirected: false,
							headers: {},
						};
					})
			);
		});
	}

	static buildQuery(params: { [key: string]: any }, doBody: boolean = true): string {
		return Object.keys(params)
			.map((f) => `${encodeURIComponent(f)}=${doBody ? encodeURIComponent(params[f]) : params[f]}`)
			.join('&');
	}

	/**
	 * Send a request with an expected JSON response.
	 */
	static async json<R extends {} = Record<string, any>>(
		url: string,
		init?: Omit<HttpRequest, 'url' | 'isJson'>
	): Promise<JSONResponse<R>> {
		if (init) {
			return Message.send('request', { ...init, url, isJson: true }) as Promise<JSONResponse<R>>;
		}
		return Message.send('request', { url, isJson: true }) as Promise<JSONResponse<R>>;
	}

	/**
	 * Send a GET request.
	 * @param url The URL to send the GET request to
	 * @param init RequestInit params
	 */
	static async get<R = string>(url: string, init?: Omit<HttpRequest, 'url' | 'method'>): Promise<HttpResponse<R>> {
		if (init) {
			return Message.send('request', { ...init, method: 'GET', url }) as Promise<HttpResponse<R>>;
		}
		return Message.send('request', { method: 'GET', url }) as Promise<HttpResponse<R>>;
	}

	/**
	 * Send a POST request.
	 * @param url The URL to send the POST request to
	 * @param init RequestInit params
	 */
	static async post<R = string>(url: string, init: Omit<HttpRequest, 'url' | 'method'>): Promise<HttpResponse<R>> {
		if (init) {
			return Message.send('request', { ...init, method: 'POST', url }) as Promise<HttpResponse<R>>;
		}
		return Message.send('request', { method: 'POST', url }) as Promise<HttpResponse<R>>;
	}

	/**
	 * Send a PUT request.
	 * @param url The URL to send the POST request to
	 * @param init RequestInit params
	 */
	static async put<R = string>(url: string, init: Omit<HttpRequest, 'url' | 'method'>): Promise<HttpResponse<R>> {
		if (init) {
			return Message.send('request', { ...init, method: 'PUT', url }) as Promise<HttpResponse<R>>;
		}
		return Message.send('request', { method: 'PUT', url }) as Promise<HttpResponse<R>>;
	}

	/**
	 * Send a PATCH request.
	 * @param url The URL to send the POST request to
	 * @param init RequestInit params
	 */
	static async patch<R = string>(url: string, init: Omit<HttpRequest, 'url' | 'method'>): Promise<HttpResponse<R>> {
		if (init) {
			return Message.send('request', { ...init, method: 'PATCH', url }) as Promise<HttpResponse<R>>;
		}
		return Message.send('request', { method: 'PATCH', url }) as Promise<HttpResponse<R>>;
	}

	/**
	 * Send a DELETE request.
	 * @param url The URL to send the POST request to
	 * @param init RequestInit params
	 */
	static async delete<R = string>(url: string, init: Omit<HttpRequest, 'url' | 'method'>): Promise<HttpResponse<R>> {
		if (init) {
			return Message.send('request', { ...init, method: 'DELETE', url }) as Promise<HttpResponse<R>>;
		}
		return Message.send('request', { method: 'DELETE', url }) as Promise<HttpResponse<R>>;
	}

	/**
	 * Return the ResponseStatus associated to a HttpResponse code.
	 * @param code The HttpResponse code
	 */
	static status(code: number): ResponseStatus {
		if (code == 0) return ResponseStatus.FAIL;
		else if (code >= 500) return ResponseStatus.SERVER_ERROR;
		else if (code == 401) return ResponseStatus.UNAUTHORIZED;
		else if (code == 404) return ResponseStatus.NOT_FOUND;
		else if (code >= 400) return ResponseStatus.BAD_REQUEST;
		return ResponseStatus.SUCCESS;
	}

	/**
	 * Return the description of a ResponseStatus
	 * @param status The ReponseStatus
	 */
	static statusToString(status: ResponseStatus): string {
		switch (status) {
			case ResponseStatus.SERVER_ERROR:
				return 'Server Error';
			case ResponseStatus.BAD_REQUEST:
				return 'Bad Request';
			case ResponseStatus.UNAUTHORIZED:
			case ResponseStatus.MISSING_TOKEN:
				return 'Logged Out';
			case ResponseStatus.NOT_FOUND:
				return 'Not Found';
			case ResponseStatus.FAIL:
			default:
				return 'Error';
		}
	}
}

import { debug } from './Log';

type EventList<K extends keyof EventPayloads> = {
	[key in K]?: { [id: number]: EventDescription<K> };
};
const listeners: EventList<keyof EventPayloads> = {};
let nextListener: number = 0;
const listenersMap: { [key: number]: keyof EventPayloads } = {};

/**
 * Listen for an event and trigger callback on event.
 * @param event Event name
 * @param callback Callback function when the event triggers
 */
export function listen<K extends keyof EventPayloads>(
	event: K,
	callback: EventCallback<K>,
	options?: EventOptions
): number {
	if (!listeners[event]) listeners[event] = {};
	const id = nextListener++;
	(listeners[event] as { [id: number]: EventDescription<K> })[id] = { callback, options };
	listenersMap[id] = event;
	return id;
}

/**
 * Manually trigger an event and pass payload to each listeners callback.
 * @param event Event name
 * @param payload Payload given to the callbacks
 */
export function dispatch<K extends keyof EventPayloads>(event: K, payload: EventPayloads[K]): void {
	if (!listeners[event]) {
		debug(`No listeners for triggered {${event}}`);
		return;
	}
	debug(`triggered {${event}} for ${Object.keys(listeners[event]!).length} listeners`);
	// Start listeners callback in anonymous function to not block trigger call with blocking events
	(async () => {
		for (const id in listeners[event]!) {
			if (listeners[event]![id].options?.blocking) {
				await (listeners[event]![id].callback as EventCallback<K>)(payload);
			} else (listeners[event]![id].callback as EventCallback<K>)(payload);
		}
	})();
}

/**
 * Remove an event listener identified by ID.
 * @param id The ID of the Event
 */
export function removeListener(id: number): boolean {
	if (listenersMap[id] && listeners[listenersMap[id]]![id]) {
		delete listeners[listenersMap[id]]![id];
		delete listenersMap[id];
		return true;
	}
	return false;
}

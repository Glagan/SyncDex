type EventID<K extends keyof EventPayloads> = { [id: number]: EventDescription<K> };
type EventList<K extends keyof EventPayloads> = {
	[key in K]?: EventID<K>;
};
let nextListener: number = 0;
const listeners: EventList<keyof EventPayloads> = {};
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
export function dispatch<K extends keyof EventPayloads>(...params: EventDispatchParams<K>): void {
	const event = params[0];
	if (!listeners[event]) {
		console.debug(`No listeners for triggered {${event}}`);
		return;
	}
	console.debug(`triggered {${event}} for ${Object.keys(listeners[event]!).length} listeners`);
	// Start listeners callback in anonymous function to not block trigger call with blocking events
	const payload = params[1];
	(async () => {
		for (const id in listeners[event]!) {
			if (listeners[event]![id].options?.blocking) {
				await listeners[event]![id].callback(payload!);
			} else listeners[event]![id].callback(payload!);
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

type RouteFunction = () => void;

/**
 * Pattern/Function pair.
 */
class Route {
	location: string;
	fnct: RouteFunction;

	constructor(location: string, fnct: RouteFunction) {
		this.location = location;
		this.fnct = fnct;
	}
}

export class Router {
	routes: Route[] = [];

	/**
	 * Register location(s) to a function to be executed on match.
	 */
	register(location: string | string[], fnct: RouteFunction): void {
		if (!(location instanceof Array)) {
			location = [location];
		}
		for (const route of location) {
			this.routes.push(new Route(route, fnct));
		}
	}

	/**
	 * Check all registered routes against a location.
	 */
	match(location: string): RouteFunction | null {
		for (const route of this.routes) {
			if (location.match(route.location)) {
				return route.fnct;
			}
		}
		return null;
	}
}

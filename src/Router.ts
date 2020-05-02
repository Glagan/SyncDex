type RouteFunction = () => void;

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

	register(location: string | string[], fnct: RouteFunction): void {
		if (!(location instanceof Array)) {
			location = [location];
		}
		for (const route of location) {
			this.routes.push(new Route(route, fnct));
		}
	}

	match(location: string): RouteFunction | null {
		for (const route of this.routes) {
			if (location.match(route.location)) {
				return route.fnct;
			}
		}
		return null;
	}
}

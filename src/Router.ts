type RouteFunction = () => void;

class Route {
	location: string;
	fnct: RouteFunction;

	constructor(location: string, fnct: RouteFunction) {
		this.location = location;
		this.fnct = fnct;
	}
}

class Router {
	routes: Route[] = [];

	register(location: string | string[], fnct: RouteFunction): void {
		if (!(location instanceof Array)) {
			location = [location];
		}
		for (let index = 0; index < location.length; index++) {
			const route = location[index];
			this.routes.push(new Route(route, fnct));
		}
	}

	match(location: string): RouteFunction | null {
		for (let index = 0; index < this.routes.length; index++) {
			const route = this.routes[index];
			if (location.match(route.location)) {
				return route.fnct;
			}
		}
		return null;
	}
}

export { Router };

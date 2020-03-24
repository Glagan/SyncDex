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

	register(location: string, fnct: RouteFunction): void {
		this.routes.push(new Route(location, fnct));
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

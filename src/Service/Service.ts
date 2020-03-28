export interface Service {
	name: string;
	statusValue: { [key in Status]: number | string };
}

export interface HTMLService extends Service {
	document: Document;
}

export interface JSONService extends Service {
	document: Object;
}

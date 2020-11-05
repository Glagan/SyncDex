import { Service, ServiceKey } from '../../Core/Service';

export class ImportExportManager {
	services: Service[] = [];
	// Import/Export
	importContainer: HTMLElement;
	exportContainer: HTMLElement;

	constructor() {
		// Import/Export
		this.importContainer = document.getElementById('import-container')!;
		this.exportContainer = document.getElementById('export-container')!;

		// Add Services
		for (const key in ServiceKey) {
			/*if (Services[key] === undefined) continue;
			// `service` is *NOT* an abstract class
			const ServiceConstructor = Services[key];
			/// @ts-ignore
			const service = new ServiceConstructor(this) as Service;
			this.services.push(service);
			if (service.importModule) {
				const card = service.createCard(false);
				card.addEventListener('click', () => {
					service.importModule!.reset();
					service.importModule!.modal.show();
				});
				DOM.append(this.importContainer, card);
			}
			if (service.exportModule) {
				const card = service.createCard(false);
				card.addEventListener('click', () => {
					service.exportModule!.reset();
					service.exportModule!.modal.show();
				});
				DOM.append(this.exportContainer, card);
			}*/
		}
	}
}

import { DOM } from '../../Core/DOM';
import { Service } from '../Service/Service';
import { ServiceName } from '../../Core/Title';
import { GetService } from './Service';

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
		for (const serviceName in ServiceName) {
			// `service` is *NOT* an abstract class
			const ServiceConstructor = GetService(serviceName as ServiceName);
			/// @ts-ignore
			const service = new ServiceConstructor(this) as Service;
			this.services.push(service);
			if (service.importModule) {
				DOM.append(this.importContainer, service.importModule.card);
			}
			if (service.exportModule) {
				DOM.append(this.exportContainer, service.exportModule.card);
			}
		}
	}
}

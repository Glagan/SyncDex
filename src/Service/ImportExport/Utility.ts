import { ExportModule, ImportModule } from '../../Core/Module';
import { ModuleInterface } from '../../Core/ModuleInterface';
import { Services } from '../Class/Map';
import { ActivableKey } from '../Keys';
import { ServicesExport, ServicesImport } from './Map';

export function createModule(
	key: ActivableKey,
	type: 'import',
	moduleInterface?: ModuleInterface
): ImportModule | false;
export function createModule(
	key: ActivableKey,
	type: 'export',
	moduleInterface?: ModuleInterface
): ExportModule | false;
export function createModule(
	key: ActivableKey,
	type: 'import' | 'export',
	moduleInterface?: ModuleInterface
): ImportModule | ExportModule | false {
	const map = type == 'import' ? ServicesImport : ServicesExport;
	if (!map[key]) return false;
	const module = map[key]!;
	return new module(Services[key], moduleInterface);
}

import { loadLogs, log } from '../Core/Log';
import { Message } from '../Core/Message';
import { ModuleStatus } from '../Core/Module';
import { Options } from '../Core/Options';
import { Storage } from '../Core/Storage';
import { Services } from '../Service/Class/Map';
import { createModule } from '../Service/ImportExport/Utility';

export namespace ImportExport {
	export async function silentImport(manual: boolean = false) {
		await Options.load();
		await loadLogs(true);

		if (manual || (Options.checkOnStartup && Options.services.length > 0)) {
			const checkCooldown = Options.checkOnStartupCooldown * 60 * 1000;
			const lastCheck: number | string[] = await Storage.get('import', 0);
			if (manual || typeof lastCheck !== 'number' || Date.now() - lastCheck > checkCooldown) {
				await Storage.set(StorageUniqueKey.ImportInProgress, true);
				await Message.send('import:event:start');
				// await browser.runtime.sendMessage({ action: MessageAction.importStart }).catch((_e) => _e);
				await log('Importing lists');
				const services =
					!manual && Options.checkOnStartupMainOnly ? [Options.services[0]] : [...Options.services].reverse();
				const done: string[] = typeof lastCheck === 'object' ? lastCheck : [];
				for (const key of services) {
					if (done.indexOf(key) < 0) {
						try {
							const start = Date.now();
							await log(`Importing ${Services[key].name}`);
							const module = createModule(key, 'import');
							if (!module) continue;
							const moduleResult = await module.run();
							if (moduleResult == ModuleStatus.SUCCESS) {
								await log(`Imported ${Services[key].name} in ${Date.now() - start}ms`);
							} else await log(`Could not import ${Services[key].name} | Status: ${moduleResult}`);
						} catch (error) {
							await log(`Error while importing ${Services[key].name} ${error.stack}`);
						}
						done.push(key);
						if (!manual) await Storage.set(StorageUniqueKey.Import, done);
					} else await log(`Skipping ${Services[key].name} already imported`);
				}
				if (!manual) await Storage.set(StorageUniqueKey.Import, Date.now());
				await Storage.remove(StorageUniqueKey.ImportInProgress);
				await Message.send('import:event:finish');
				// await browser.runtime.sendMessage({ action: MessageAction.importComplete }).catch((_e) => _e);
				await log(`Done Importing lists`);
			} else
				await log(`Startup script executed less than ${Options.checkOnStartupCooldown}minutes ago, skipping`);
		} else if (Options.checkOnStartup) await log('Did not Import: No services enabled');
	}
}

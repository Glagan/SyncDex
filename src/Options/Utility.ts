import { Options } from '../Core/Options';
import { OptionsManager } from './OptionsManager';

let savingNotification: SimpleNotification;
export async function SaveOptions(): Promise<void> {
	if (savingNotification) savingNotification.remove();
	await Options.save();
	savingNotification = SimpleNotification.success({
		title: 'Options Saved',
	});
}

export function ReloadOptions(): void {
	if (OptionsManager.instance) {
		OptionsManager.instance.reload();
	}
}

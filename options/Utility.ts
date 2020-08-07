import { Options } from '../src/Options';
import { OptionsManager } from './OptionsManager';

let savingNotification: SimpleNotification;

export async function SaveOptions(): Promise<void> {
	if (savingNotification) savingNotification.remove();
	await Options.save();
	savingNotification = SimpleNotification.success(
		{
			title: 'Options Saved',
		},
		{ position: 'bottom-left' }
	);
}

export function ReloadOptions(): void {
	if (OptionsManager.instance) {
		OptionsManager.instance.reload();
	}
}

import { Options } from '../Core/Options';

let savingNotification: SimpleNotification;
export async function SaveOptions(): Promise<void> {
	if (savingNotification) savingNotification.remove();
	await Options.save();
	savingNotification = SimpleNotification.success({
		title: 'Options Saved',
	});
}

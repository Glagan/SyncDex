import { Options } from '../Core/Options';

export abstract class Page {
	static errorNotification(error: Error) {
		SimpleNotification.error(
			{
				title: error.message,
				text: 'Unexpected error, check logs and open an issue with them.',
			},
			{ duration: Options.errorDuration }
		);
	}

	abstract run(): Promise<void>;
}

import { ServiceSave } from './Save';
import { Options, AvailableOptions } from '../../src/Options';
import { FullTitle, TitleCollection } from '../../src/Title';
import { DOM } from '../../src/DOM';

export interface ImportSummary {
	options: number;
	history: boolean;
	total: number;
	invalid: number;
}

export abstract class ExtensionSave extends ServiceSave {
	/**
	 * Assign a value to the corresponding Option if it exists and it's the same type.
	 */
	assignValidOption = <K extends keyof AvailableOptions>(
		key: K,
		value: AvailableOptions[K]
	): number => {
		// Check if the value is the same type as the value in the Options
		if (typeof value === typeof Options[key]) {
			// Check if the key actually exist
			if ((Options as AvailableOptions)[key] !== undefined || key === 'mainService') {
				(Options as AvailableOptions)[key] = value;
				return 1;
			}
		}
		return 0;
	};

	/**
	 * Display summary and button to go back to Service selection
	 */
	end = (summary: ImportSummary): void => {
		this.manager.clear();
		this.manager.header(`Done Importing ${this.name}`);
		if (summary.options == 0) {
			this.manager.node.appendChild(
				DOM.create('div', {
					class: 'block notification warning',
					textContent: 'Options were not imported since there was none.',
				})
			);
		}
		if (summary.invalid > 0) {
			this.manager.node.appendChild(
				DOM.create('div', {
					class: 'block notification warning',
					textContent: `${summary.invalid} (of ${summary.total}) titles were not imported since they had invalid properties.`,
				})
			);
		}
		this.success([
			DOM.text(
				`Successfully imported ${summary.total - summary.invalid} titles, ${
					summary.options
				} Options and History !`
			),
			DOM.space(),
			DOM.create('button', {
				class: 'action',
				textContent: 'Go Back',
				events: {
					click: () => this.manager.reset(),
				},
			}),
		]);
	};
}

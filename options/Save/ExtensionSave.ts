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
	 * Add all Titles that are not in newSave.
	 * If a Title is already in newSave, all values are set to the highest.
	 */
	mergeTitles = (currentSave: TitleCollection, newSave: TitleCollection): void => {
		for (let index = 0, len = currentSave.length; index < len; index++) {
			const curTitle = currentSave.collection[index];
			if (curTitle.new) continue; // Title doesn't exist in LocalStorage
			const found = newSave.find(curTitle.id);
			// The title doesn't exist in newSave, just copy it
			if (found === undefined) {
				newSave.add(curTitle);
			} else {
				found.status = curTitle.status; // MyMangaDex has no Status, always choose SyncDex
				if (found.progress.chapter < curTitle.progress.chapter) {
					found.progress = curTitle.progress;
				}
				if (!found.initial && curTitle.initial) {
					found.initial = curTitle.initial;
				}
				found.services = Object.assign({}, curTitle.services, found.services);
				// Update all 'number' properties to select the highest ones
				type NumberKey = Pick<
					FullTitle,
					'lastRead' | 'lastTitle' | 'lastCheck' | 'lastChapter'
				>;
				const lastKeys: (keyof NumberKey)[] = [
					'lastRead',
					'lastTitle',
					'lastCheck',
					'lastChapter',
				];
				for (let index = 0; index < lastKeys.length; index++) {
					const key = lastKeys[index] as keyof NumberKey;
					if (found[key] && curTitle[key]) {
						found[key] = Math.max(found[key] as number, curTitle[key] as number);
					}
				}
				// Merge chapters array
				found.chapters = found.chapters.concat(curTitle.chapters);
				found.chapters.sort((a, b) => b - a);
				if (found.chapters.length > Options.chaptersSaved) {
					const diff = Options.chaptersSaved - found.chapters.length;
					found.chapters.splice(-diff, diff);
				}
			}
		}
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

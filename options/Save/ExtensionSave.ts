import { ExportedSave } from '../../src/interfaces';
import { ServiceSave } from './Save';
import { Options } from '../../src/Options';
import { FullTitle, Title, TitleCollection } from '../../src/Title';

export abstract class ExtensionSave extends ServiceSave {
	mergeTitles = (currentSave: TitleCollection, newSave: TitleCollection): void => {
		for (let index = 0, len = currentSave.length; index < len; index++) {
			const curTitle = currentSave.collection[index];
			if (curTitle.new) continue;
			const found = newSave.find(curTitle.id);
			if (found === undefined) {
				newSave.add(curTitle);
			} else {
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
}

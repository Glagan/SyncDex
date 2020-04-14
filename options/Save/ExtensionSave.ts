import { ExportedSave } from '../../src/interfaces';
import { ServiceSave } from './Save';
import { Options } from '../../src/Options';
import { FullTitle, Title } from '../../src/Title';

export abstract class ExtensionSave extends ServiceSave {
	mergeTitles = (currentSave: Title[], newSave: Title[]): void => {
		for (let index = 0, len = currentSave.length; index < len; index++) {
			const curTitle = currentSave[index];
			const found = Title.findInCollection(newSave, curTitle.id);
			if (found < 0) {
				newSave.push(curTitle);
			} else {
				const newTitle: FullTitle = newSave[found];
				if (newTitle.progress.chapter < curTitle.progress.chapter) {
					newTitle.progress = curTitle.progress;
				}
				if (!newTitle.initial && curTitle.initial) {
					newTitle.initial = curTitle.initial;
				}
				newTitle.services = Object.assign({}, curTitle.services, newTitle.services);
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
					if (newTitle[key] && curTitle[key]) {
						newTitle[key] = Math.max(newTitle[key] as number, curTitle[key] as number);
					}
				}
				// Merge chapters array
				newTitle.chapters = newTitle.chapters.concat(curTitle.chapters);
				newTitle.chapters.sort((a, b) => b - a);
				if (newTitle.chapters.length > Options.chaptersSaved) {
					const diff = Options.chaptersSaved - newTitle.chapters.length;
					newTitle.chapters.splice(-diff, diff);
				}
			}
		}
	};
}

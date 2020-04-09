import { ServiceImport } from './ServiceImport';
import { ExportedSave, Title } from '../../src/interfaces';

export abstract class ExtensionServiceImport extends ServiceImport {
	mergeHistory = (currentSave: ExportedSave | undefined, newSave: ExportedSave): void => {
		if (newSave.history === undefined) {
			newSave.history = [];
		}
		if (currentSave !== undefined && currentSave.history) {
			newSave.history.concat(currentSave.history);
			for (let index = 0; index < newSave.history.length; index++) {
				const titleId = newSave.history[index].toString();
				const hasTitle = newSave[titleId] !== undefined;
				if (!hasTitle) {
					if (currentSave[titleId]) {
						newSave[titleId] = currentSave[titleId];
					} else {
						newSave.history.splice(index--, 1);
					}
				}
			}
		}
	};

	mergeTitles = (currentSave: ExportedSave | undefined, newSave: ExportedSave): void => {
		if (currentSave !== undefined) {
			Object.keys(currentSave).forEach((value) => {
				if (newSave[value] === undefined) {
					newSave[value] = currentSave[value];
				} else {
					const newTitle = newSave[value];
					const curTitle = currentSave[value];
					if (newTitle.progress.chapter < curTitle.progress.chapter) {
						newTitle.progress = curTitle.progress;
					}
					if (!newTitle.initial && curTitle.initial) {
						newTitle.initial = curTitle.initial;
					}
					newTitle.services = Object.assign({}, curTitle.services, newTitle.services);
					type NumberKey = Pick<
						Title,
						'lastRead' | 'lastTitle' | 'lastCheck' | 'chapterId'
					>;
					const lastKeys = [
						'lastRead',
						'lastTitle',
						'lastCheck',
						'chapterId',
					] as NumberKey[];
					for (let index = 0; index < lastKeys.length; index++) {
						const key = lastKeys[index] as keyof NumberKey;
						if (newTitle[key] && curTitle[key]) {
							newTitle[key] = Math.max(
								newTitle[key] as number,
								curTitle[key] as number
							);
						}
					}
					newTitle.chapters = newTitle.chapters.concat(curTitle.chapters);
					newTitle.chapters.sort((a, b) => b - a);
					if (newTitle.chapters.length > this.manager.options.chaptersSaved) {
						const diff = this.manager.options.chaptersSaved - newTitle.chapters.length;
						newTitle.chapters.splice(-diff, diff);
					}
				}
			});
		}
	};
}

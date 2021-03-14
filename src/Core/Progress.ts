export namespace Progress {
	export function toString(progress: Progress): string {
		const volume = progress.volume && progress.volume > 0 ? `Vol. ${progress.volume}` : '';
		const chapter =
			progress.chapter >= 0 ? (volume ? ` Ch. ${progress.chapter}` : `Chapter ${progress.chapter}`) : '';
		return progress.oneshot ? 'Oneshot' : `${volume}${chapter}`;
	}

	/**
	 * Convert a chapter name with a chapter progress inside.
	 * Found formats:
	 * 	 	(Volume X) Chapter Y(.Z)
	 * 		(Vol. X) Ch. Y(.Z)
	 * Progress.chapter is kept as NaN on error
	 * @param chapter Chapter name
	 * @see https://regexr.com/5oheg
	 */
	export function fromString(chapter: string): Progress {
		// Oneshot
		if (chapter.toLocaleLowerCase() == 'oneshot') {
			return { chapter: 1, oneshot: true };
		}

		// (Volume X) Chapter Y(.Z) | (Vol. X) Ch. Y(.Z)
		const result = /(?:Vol(?:\.|ume)\s*([0-9]+)?\s*)?(?:Ch(?:\.|apter)\s*([0-9]+(?:\.[0-9]+)?))?/.exec(chapter);
		// Broken ?
		if (result == null) return { chapter: NaN };
		const chapterValue = parseFloat(result[2]);
		const volume = parseInt(result[1]);
		const progress: Progress = {
			chapter: isNaN(chapterValue) ? -1 : chapterValue,
			volume: isNaN(volume) ? undefined : volume,
		};
		return progress;
	}

	export function get(name: string | undefined, chapter: string | undefined, volume: string | undefined): Progress {
		const oneshot = name?.toLocaleLowerCase() == 'oneshot';
		let progress: Progress = {
			chapter: oneshot ? 1 : parseFloat(chapter!),
			volume: parseInt(volume!),
			oneshot,
		};
		// Fallback to progress in chapter name
		if (isNaN(progress.chapter)) {
			if (name) {
				progress = fromString(name);
			} else progress.chapter = 0;
		}
		if (progress.volume !== undefined && isNaN(progress.volume)) {
			progress.volume = undefined;
		}
		return progress;
	}

	/**
	 * Return true if p2 is higher to p1.
	 * @param p1
	 * @param p2
	 */
	export function isHigher(p1: Progress, p2: Progress): boolean {
		return (
			(p2.chapter > p1.chapter && (!p2.volume || !p1.volume || p2.volume >= p1.volume)) ||
			(!!p2.volume && !!p1.volume && p2.volume > p1.volume)
		);
	}

	/**
	 * Return true if p2 is following to p1.
	 * Does not account for first chapter, see Title.isNextChapter.
	 * @param p1
	 * @param p2
	 */
	export function isNext(p1: Progress, p2: Progress): boolean {
		return (
			// Next from chapter (progress < current + 2) to handle sub-chapters
			(p2.chapter > p1.chapter && p2.chapter < Math.floor(p1.chapter) + 2) ||
			// Next from volume (p2 == current + 1) if p2 has no chapter
			(p2.chapter < 0 && p2.volume !== undefined && p1.volume !== undefined && p2.volume == p1.volume + 1)
		);
	}

	/**
	 * Return true if p2 is equal to p1.
	 * @param p1
	 * @param p2
	 */
	export function isEqual(p1: Progress, p2: Progress): boolean {
		return (
			(p1.chapter === p2.chapter && (!p2.volume || !p1.volume || p1.volume === p2.volume)) ||
			(p2.chapter < 0 && p1.volume === p2.volume)
		);
	}

	/**
	 * Return true if p2 is lower than p1.
	 * @param p1
	 * @param p2
	 */
	export function isLower(p1: Progress, p2: Progress): boolean {
		return (
			(p2.chapter < p1.chapter && (!p2.volume || !p1.volume || p2.volume <= p1.volume)) ||
			(!!p2.volume && !!p1.volume && p2.volume < p1.volume)
		);
	}
}

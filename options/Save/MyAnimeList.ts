import { ServiceSave, Input, FileInput } from './Save';
import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Progress } from '../../src/interfaces';
import { Mochi } from '../../src/Mochi';
import { Status } from '../../src/Service/Service';

enum MyAnimeListStatus {
	Completed = 'Completed',
	'Plan to Read' = 'Plan to Read',
	Reading = 'Reading',
	'On-Hold' = 'On-Hold',
	Dropped = 'Dropped',
	Invalid = 'Invalid',
}

interface MyAnimeListTitle {
	id: number;
	chapters: number;
	volumes: number;
	status: MyAnimeListStatus;
}

export class MyAnimeList extends ServiceSave {
	name: string = 'MyAnimeList';
	key: string = 'mal';

	parser: DOMParser = new DOMParser();
	form?: HTMLFormElement;

	import = (): void => {
		this.manager.clear();
		this.manager.header('Select your MyAnimeList export file');
		this.notification('info', [
			DOM.text('You can download your Manga list'),
			DOM.space(),
			DOM.create('a', {
				textContent: 'here',
				attributes: {
					href: 'https://myanimelist.net/panel.php?go=export',
					rel: 'noreferrer noopener',
					target: '_blank',
				},
			}),
			DOM.text('.'),
		]);
		this.notification(
			'warning',
			'You need to extract the downloaded file before uploading, the extension need to be xml and not gz.'
		);
		this.form = this.createForm(
			[new FileInput('file', 'MyAnimeList export file (.xml)', 'application/xml')],
			(event) => this.handleExportFile(event)
		);
	};

	validMyAnimeListTitle = (title: MyAnimeListTitle): boolean => {
		return (
			!isNaN(title.id) &&
			!isNaN(title.chapters) &&
			!isNaN(title.volumes) &&
			MyAnimeListStatus[title.status] !== undefined &&
			title.status !== MyAnimeListStatus.Invalid
		);
	};

	toStatus = (status: MyAnimeListStatus): Status => {
		if (status == 'Completed') {
			return Status.COMPLETED;
		} else if (status == 'Plan to Read') {
			return Status.PLAN_TO_READ;
		} else if (status == 'Reading') {
			return Status.READING;
		} else if (status == 'On-Hold') {
			return Status.PAUSED;
		} else if (status == 'Dropped') {
			return Status.DROPPED;
		}
		return Status.NONE;
	};

	handleExportFile = (event: Event): void => {
		event.preventDefault();
		this.removeNotifications();
		if (this.form === undefined) return;
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result == 'string') {
				try {
					const body = this.parser.parseFromString(reader.result, 'application/xml');
					// Check if user_export_type is set and equals 2 for manga lists
					const infos = body.querySelector('myinfo') ?? undefined;
					const exportType = infos?.querySelector('user_export_type') ?? undefined;
					if (
						infos === undefined ||
						exportType === undefined ||
						exportType.textContent !== '2'
					) {
						this.error('Invalid file !');
						return;
					}
					this.manager.clear();
					this.manager.header('Import MyAnimeList Save');
					let currentNotification = this.notification(
						'info loading',
						'Step 1: Reading Save file'
					);
					// Get a list of MAL Titles
					const titles = new TitleCollection();
					const myAnimeListTitles: MyAnimeListTitle[] = [];
					const mangaList = body.querySelectorAll('manga');
					for (let index = 0, len = mangaList.length; index < len; index++) {
						const manga = mangaList[index] as HTMLElement;
						const title = {
							id: parseInt(
								manga.querySelector('manga_mangadb_id')?.textContent || ''
							),
							chapters: parseInt(
								manga.querySelector('my_read_chapters')?.textContent || ''
							),
							volumes: parseInt(
								manga.querySelector('my_read_volumes')?.textContent || ''
							),
							status: (manga.querySelector('my_status')?.textContent ||
								'Invalid') as MyAnimeListStatus,
						};
						if (this.validMyAnimeListTitle(title)) {
							myAnimeListTitles.push(title);
						}
					}
					currentNotification.classList.remove('loading');
					const totalValid = myAnimeListTitles.length;
					this.notification('success', `Found ${myAnimeListTitles.length} valid titles.`);
					currentNotification = this.notification(
						'info loading',
						`Step 2: Find MangaDex IDs from MyAnimeList IDs, 0 out of ${totalValid}`
					);
					// Get a list of MangaDex ID for every MAL IDs
					let totalAdded = 0;
					for (let index = 0, len = myAnimeListTitles.length; index < len; index++) {
						const myAnimeListTitle = myAnimeListTitles[index];
						const connections = await Mochi.find(myAnimeListTitle.id, 'MyAnimeList');
						if (connections !== undefined) {
							for (let index = 0, len = connections.length; index < len; index++) {
								const connection = connections[index];
								if (connection.service === 'MangaDex') {
									titles.add(
										new Title(connection.id as number, {
											services: { mal: myAnimeListTitle.id },
											progress: {
												chapter: myAnimeListTitle.chapters,
												volume: myAnimeListTitle.volumes,
											},
											status: this.toStatus(myAnimeListTitle.status),
											chapters: [],
										})
									);
									totalAdded++;
									break;
								}
							}
						}
						currentNotification.textContent = `Step 2: Find MangaDex IDs from MyAnimeList IDs, ${
							index + 1
						} out of ${totalValid}`;
					}
					currentNotification.classList.remove('loading');
					currentNotification = this.notification(
						'info',
						`Step 3: Saving a total of ${totalAdded} (ouf of ${totalValid}).`
					);
					// Done, merge and save
					titles.merge(await TitleCollection.get(titles.ids));
					await titles.save();
					this.success([
						DOM.text(`Done ! Imported ${totalAdded} Titles from MyAnimeList`),
						DOM.space(),
						this.resetButton(),
					]);
				} catch (error) {
					console.error(error);
					this.error('Invalid file !');
				}
			}
		};
		if (this.form.file.files.length > 0) {
			reader.readAsText(this.form.file.files[0]);
		} else {
			this.error('No file selected !');
		}
	};

	/* TODO: MyAnimeList doesn't have the same URL for adding/editing titles
			 I need to get the list of titles *really* in the list before adding or updating things */
	export = (): void => {};
}

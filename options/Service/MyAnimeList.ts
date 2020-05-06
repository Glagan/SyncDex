import { DOM } from '../../src/DOM';
import { TitleCollection, Title } from '../../src/Title';
import { Mochi } from '../../src/Mochi';
import { Status, LoginStatus, LoginMethod } from '../../src/Service/Service';
import { FileInput, Service, ActivableModule, ImportableModule, ExportableModule, ImportType } from './Service';
import { ServiceName } from '../Manager/Service';
import { RawResponse, Runtime } from '../../src/Runtime';

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

interface MyAnimeListSave {
	// TODO
}

class MyAnimeListActive extends ActivableModule {
	loginMethod: LoginMethod = LoginMethod.EXTERNAL;
	loginUrl: string = 'https://myanimelist.net/login.php';
	login = undefined;
	logout = undefined;

	isLoggedIn = async <T>(reference?: T): Promise<LoginStatus> => {
		const response = await Runtime.request<RawResponse>({
			url: this.loginUrl,
			method: 'GET',
			credentials: 'include',
		});
		if (response.status >= 500) {
			return LoginStatus.SERVER_ERROR;
		} else if (response.status >= 400 && response.status < 500) {
			return LoginStatus.BAD_REQUEST;
		}
		if (response.status >= 200 && response.status < 400 && response.body && response.url.indexOf('login.php') < 0)
			return LoginStatus.SUCCESS;
		return LoginStatus.FAIL;
	};
}

class MyAnimeListImport extends ImportableModule {
	importType: ImportType = ImportType.FILE;
	parser: DOMParser = new DOMParser();
	form?: HTMLFormElement;
	convertOptions = undefined;

	fileToTitles = <T extends MyAnimeListSave>(file: T): TitleCollection => {
		return new TitleCollection();
	};

	import = async (): Promise<void> => {
		this.notification('success', 'Select your MyAnimeList export file.');
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
		if (this.form === undefined) return;
		var reader = new FileReader();
		reader.onload = async (): Promise<void> => {
			if (typeof reader.result == 'string') {
				try {
					const body = this.parser.parseFromString(reader.result, 'application/xml');
					// Check if user_export_type is set and equals 2 for manga lists
					const infos = body.querySelector('myinfo') ?? undefined;
					const exportType = infos?.querySelector('user_export_type') ?? undefined;
					if (infos === undefined || exportType === undefined || exportType.textContent !== '2') {
						this.notification('danger', 'Invalid file !');
						return;
					}
					this.service.manager.resetSaveContainer();
					this.service.manager.header('Import MyAnimeList Save');
					let notification = this.notification('info loading', 'Step 1: Reading Save file');
					// Get a list of MAL Titles
					const titles = new TitleCollection();
					const myAnimeListTitles: MyAnimeListTitle[] = [];
					const mangaList = body.querySelectorAll<HTMLElement>('manga');
					for (const manga of mangaList) {
						const title = {
							id: parseInt(manga.querySelector('manga_mangadb_id')?.textContent || ''),
							chapters: parseInt(manga.querySelector('my_read_chapters')?.textContent || ''),
							volumes: parseInt(manga.querySelector('my_read_volumes')?.textContent || ''),
							status: (manga.querySelector('my_status')?.textContent || 'Invalid') as MyAnimeListStatus,
						};
						if (this.validMyAnimeListTitle(title)) {
							myAnimeListTitles.push(title);
						}
					}
					notification.classList.remove('loading');
					const totalValid = myAnimeListTitles.length;
					this.notification('success', `Found ${myAnimeListTitles.length} valid titles.`);
					// Get a list of MangaDex ID for every MAL IDs
					let totalAdded = 0;
					let doStop = false;
					const stopButton = this.stopButton(() => {
						doStop = true;
					});
					notification = this.notification('info loading', [
						DOM.text(`Step 2: Find MangaDex IDs from MyAnimeList IDs, 0 out of ${totalValid}`),
						DOM.space(),
						stopButton,
					]);
					for (let i = 0, len = myAnimeListTitles.length; !doStop && i < len; i++) {
						const myAnimeListTitle = myAnimeListTitles[i];
						const connections = await Mochi.find(myAnimeListTitle.id, 'MyAnimeList');
						if (connections !== undefined && connections['MangaDex'] !== undefined) {
							titles.add(
								new Title(connections['MangaDex'] as number, {
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
						}
						(notification.firstChild as Text).textContent = `Step 2: Find MangaDex IDs from MyAnimeList IDs, ${
							i + 1
						} out of ${totalValid}.`;
					}
					notification.classList.remove('loading');
					stopButton.remove();
					if (doStop) {
						this.notification('success', [DOM.text('You canceled the Import. '), this.resetButton()]);
						return;
					}
					notification = this.notification(
						'info',
						`Step 3: Saving a total of ${totalAdded} (ouf of ${totalValid}).`
					);
					// Done, merge and save
					titles.merge(await TitleCollection.get(titles.ids));
					await titles.save();
					this.notification('success', [
						DOM.text(`Done ! Imported ${totalAdded} Titles from MyAnimeList`),
						DOM.space(),
						this.resetButton(),
					]);
				} catch (error) {
					console.error(error);
					this.notification('danger', 'Invalid file !');
				}
			}
		};
		if (this.form.file.files.length > 0) {
			reader.readAsText(this.form.file.files[0]);
		} else {
			this.notification('danger', 'No file selected !');
		}
	};
}

class MyAnimeListExport extends ExportableModule {
	/* TODO: MyAnimeList doesn't have the same URL for adding/editing titles
			 I need to get the list of titles *really* in the list before adding or updating things */
	export = async (): Promise<void> => {};
}

export class MyAnimeList extends Service {
	name: ServiceName = ServiceName.MyAnimeList;
	key: string = 'mal';

	activeModule: ActivableModule = new MyAnimeListActive(this);
	importModule: ImportableModule = new MyAnimeListImport(this);
	exportModule: ExportableModule = new MyAnimeListExport(this);
}

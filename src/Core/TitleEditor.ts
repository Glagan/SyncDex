import { StatusMap, Title } from './Title';
import { DOM, AppendableElement } from './DOM';
import { Modal } from './Modal';
import { dateFormatInput } from './Utility';
import { Options } from './Options';
import { SyncModule } from './SyncModule';
import { Service } from './Service';
import { Services } from '../Service/Class/Map';
import { ActivableKey } from '../Service/Keys';
import { Extension } from './Extension';

interface HistoryChapter {
	node: HTMLElement;
	chapter: number;
}

export class TitleEditor {
	static modalRow(content: AppendableElement[]): HTMLElement {
		return DOM.create('div', { class: 'row', childs: content });
	}

	static modalGroup(title: string, inputFor: string, content: string | AppendableElement[]): HTMLElement {
		return DOM.create('div', {
			class: 'group',
			childs: [
				DOM.create('label', { textContent: title, htmlFor: inputFor }),
				...(typeof content === 'string' ? [DOM.text(content)] : content),
			],
		});
	}

	static statusOptions(title: Title): HTMLSelectElement {
		const select = DOM.create('select', { id: 'ee_status', name: 'status', required: true });
		let value = 0;
		for (const status of Object.values(StatusMap)) {
			if (status == '0') continue;
			const option = DOM.create('option', { textContent: status, value: `${value}` });
			if (title.status == value++) option.selected = true;
			select.appendChild(option);
		}
		return select;
	}

	static createHistoryChapter = (nodes: HistoryChapter[], chapter: number): HTMLElement => {
		const chapterNode = DOM.create('div', {
			class: 'chapter',
			textContent: `${chapter}`,
			events: {
				click: (event) => {
					event.preventDefault();
					const index = nodes.findIndex((n) => n.chapter == chapter);
					if (index >= 0) {
						nodes.splice(index, 1);
						chapterNode.remove();
					}
				},
			},
		});
		return chapterNode;
	};

	static createServiceInput = (service: Service, force: boolean, value?: MediaKey): AppendableElement[] => {
		const forceCheckbox = DOM.create('input', { type: 'checkbox', id: `${service.key}_force`, checked: force });
		const idInput = DOM.create('input', {
			type: 'number',
			name: `${service.key}_id`,
			placeholder: `${service.name} ID`,
			value: `${value?.id ?? ''}`,
		});
		const inputs: AppendableElement[] = [
			forceCheckbox,
			DOM.create('label', { htmlFor: `${service.key}_force`, title: 'Avoid overwriting ID on update.' }),
			DOM.space(),
			idInput,
		];
		let slugInput: HTMLInputElement | undefined;
		if (service.usesSlug) {
			slugInput = DOM.create('input', {
				type: 'string',
				name: `${service.key}_slug`,
				placeholder: `${service.name} Slug`,
				value: `${value?.slug ?? ''}`,
			});
			inputs.push(slugInput);
		}
		const updateForce = () => {
			if (force || parseInt(idInput.value) != value?.id || slugInput?.value != value?.slug) {
				forceCheckbox.checked = true;
			} else forceCheckbox.checked = false;
		};
		idInput.addEventListener('input', updateForce);
		slugInput?.addEventListener('input', updateForce);
		if (Options.services.indexOf(service.key) >= 0) {
			idInput.style.borderColor = '#00c8d7';
			if (slugInput) slugInput.style.borderColor = '#00c8d7';
		}
		return inputs;
	};

	static service(form: HTMLFormElement, key: ActivableKey): ServiceEditorValue {
		let found = false;
		const mediaKey = {} as MediaKey;
		if (form[`${key}_id`] !== undefined) {
			const id = parseInt(form[`${key}_id`].value);
			if (!isNaN(id) && id > 0) {
				mediaKey.id = id;
				found = true;
			}
		}
		if (Services[key].usesSlug && form[`${key}_slug`] !== undefined && form[`${key}_slug`].value) {
			mediaKey.slug = form[`${key}_slug`].value;
			found = true;
		}
		const forced = form[`${key}_force`]?.checked;
		return { found, mediaKey, forced };
	}

	static create(syncModule: SyncModule): Modal {
		const title = syncModule.title;
		const modal = new Modal('medium');
		modal.header.classList.add('title');
		modal.header.textContent = 'Edit Entry';
		modal.wrapper.classList.add('entry-edit');
		// Buttons to add classes later
		const submitButton = DOM.create('button', {
			class: 'primary puffy',
			childs: [DOM.icon('save'), DOM.text('Save')],
			type: 'submit',
		});
		submitButton.setAttribute('form', 'entry-form');
		const cancelButton = DOM.create('button', {
			class: 'default',
			childs: [DOM.icon('times-circle'), DOM.text('Cancel')],
			events: {
				click: (event) => {
					event.preventDefault();
					modal.remove();
				},
			},
		});
		// Active Service on the Title
		const services = DOM.create('div', { class: 'services' });
		for (const sn of Object.values(ActivableKey)) {
			const serviceKey = sn as ActivableKey;
			const serviceName = Services[serviceKey].name;
			const link = DOM.create('a', {
				href: '#',
				title: serviceName,
				childs: [DOM.create('img', { src: Extension.icon(serviceKey), title: serviceName })],
			});
			if (title.services[serviceKey]) {
				link.href = Services[serviceKey].link(title.services[serviceKey]!);
				link.target = '_blank';
			}
			services.appendChild(
				DOM.create('div', {
					class: 'service',
					childs: [
						link,
						DOM.space(),
						...this.createServiceInput(
							Services[serviceKey],
							title.doForceService(serviceKey),
							title.services[serviceKey]!
						),
					],
				})
			);
		}
		// Create form with every rows
		const form = DOM.create('form', { class: 'save-entry', name: 'entry-form' });
		const updateAllCheckbox = DOM.create('input', { type: 'checkbox', id: 'scs_updateAll', checked: true });
		const deleteAllCheckbox = DOM.create('input', { type: 'checkbox', id: 'scs_deleteAll', checked: true });
		const realSubmit = DOM.create('button', {
			type: 'submit',
			css: { display: 'none' },
		});
		// Chapter and Volume inputs can be updated with the Max Chapter/Volume if there is one
		const statusSelect = this.statusOptions(title);
		let previousChapterVolume: [string, string] | undefined = undefined;
		const chapterInput = DOM.create('input', {
			id: 'ee_chapter',
			name: 'chapter',
			type: 'number',
			placeholder: 'Chapter',
			value: `${title.chapter}`,
			min: '0',
			step: 'any',
			required: true,
			events: {
				change: () => (previousChapterVolume = undefined),
			},
		});
		const chapterColumn = this.modalGroup('Chapter', 'ee_chapter', [chapterInput]);
		const volumeInput = DOM.create('input', {
			id: 'ee_volume',
			name: 'volume',
			type: 'number',
			placeholder: 'Volume',
			value: title.volume ? `${title.volume}` : '',
			events: { change: () => (previousChapterVolume = undefined) },
		});
		const volumeColumn = this.modalGroup('Volume', 'ee_volume', [volumeInput]);
		if (title.max?.chapter) {
			DOM.append(
				chapterColumn.firstElementChild as HTMLElement,
				DOM.space(),
				DOM.text('('),
				DOM.create('b', {
					textContent: `${title.max.chapter}`,
					title: 'Max Chapter - Click to set as Completed',
					events: {
						click: () => {
							previousChapterVolume = [chapterInput.value, volumeInput.value];
							statusSelect.value = `${Status.COMPLETED}`;
							chapterInput.value = `${title.max!.chapter}`;
							if (title.max!.volume) volumeInput.value = `${title.max!.volume}`;
						},
					},
				}),
				DOM.text(')')
			);
		}
		if (title.max?.volume) {
			DOM.append(
				volumeColumn.firstElementChild as HTMLElement,
				DOM.space(),
				DOM.text('('),
				DOM.create('b', {
					textContent: `${title.max.volume}`,
					title: 'Max Volume - Click to set as Completed',
					events: {
						click: () => {
							previousChapterVolume = [chapterInput.value, volumeInput.value];
							statusSelect.value = `${Status.COMPLETED}`;
							if (title.max!.chapter) chapterInput.value = `${title.max!.chapter}`;
							volumeInput.value = `${title.max!.volume}`;
						},
					},
				}),
				DOM.text(')')
			);
		}
		// Update Chapter/Volume on COMPLETED select
		statusSelect.addEventListener('change', () => {
			if (!title.max?.chapter) return;
			if (statusSelect.value == `${Status.COMPLETED}`) {
				previousChapterVolume = [chapterInput.value, volumeInput.value];
				chapterInput.value = `${title.max.chapter}`;
				if (title.max.volume) volumeInput.value = `${title.max.volume}`;
			} else if (previousChapterVolume) {
				chapterInput.value = previousChapterVolume[0];
				volumeInput.value = previousChapterVolume[1];
				previousChapterVolume = undefined;
			}
		});
		// History
		const history = DOM.create('div', {
			class: 'hidden',
			childs: [
				DOM.create('div', {
					class: 'message',
					childs: [
						DOM.create('div', { class: 'icon' }),
						DOM.create('div', { class: 'content', textContent: 'Click on a chapter to delete it.' }),
					],
				}),
			],
		});
		let historyChapters: { node: HTMLElement; chapter: number }[] = [];
		for (const chapter of title.chapters) {
			const chapterNode = this.createHistoryChapter(historyChapters, chapter);
			historyChapters.push({ node: chapterNode, chapter: chapter });
			history.appendChild(chapterNode);
		}
		const historyForm = DOM.create('form', {
			class: 'chapter',
			childs: [
				DOM.create('input', {
					type: 'number',
					min: '0',
					step: 'any',
					name: 'chapter',
					placeholder: 'Chapter',
				}),
				DOM.create('button', { type: 'submit', class: 'primary small', textContent: 'Add' }),
			],
			events: {
				submit: (event) => {
					event.preventDefault();
					const input = historyForm.chapter;
					const chapter = parseFloat(input.value);
					if (!isNaN(chapter)) {
						const max = historyChapters.length;
						const historyChapter = {
							node: this.createHistoryChapter(historyChapters, chapter),
							chapter: chapter,
						};
						historyChapter.node.classList.add('flashing');
						for (let i = 0; i <= max; i++) {
							if (i == max) {
								historyChapters.push(historyChapter);
								history.insertBefore(historyChapter.node, history.lastElementChild);
								break;
							} else if (historyChapters[i].chapter == chapter) {
								break;
							} else if (chapter < historyChapters[i].chapter) {
								history.insertBefore(historyChapter.node, historyChapters[i].node);
								historyChapters.splice(i, 0, historyChapter);
								break;
							}
						}
					}
					input.value = '';
				},
			},
		});
		history.appendChild(historyForm);
		const showHistory = DOM.icon('angle-down');
		// Create all rows
		DOM.append(
			form,
			this.modalRow([
				this.modalGroup('MangaDex', '', [
					DOM.create('span', { class: 'helper', textContent: `# ${title.key.id}` }),
				]),
				this.modalGroup('Name', 'ee_name', [
					DOM.create('input', {
						id: 'ee_name',
						name: 'mediaName',
						type: 'text',
						placeholder: 'Name',
						value: title.name ? title.name : '',
					}),
				]),
			]),
			this.modalRow([chapterColumn, volumeColumn]),
			this.modalRow([
				this.modalGroup('Status', 'status', [statusSelect]),
				this.modalGroup('Score (0-100)', 'ee_score', [
					DOM.create('input', {
						id: 'ee_score',
						name: 'score',
						type: 'number',
						placeholder: 'Score (0-100)',
						min: '0',
						max: '100',
						value: title.score > 0 ? `${title.score}` : '',
					}),
				]),
			]),
			this.modalRow([
				this.modalGroup('Start', 'ee_start', [
					DOM.create('input', {
						id: 'ee_start',
						name: 'start',
						type: 'date',
						placeholder: 'Start Date',
						value: title.start ? dateFormatInput(title.start) : '',
					}),
				]),
				this.modalGroup('End', 'ee_end', [
					DOM.create('input', {
						id: 'ee_end',
						name: 'end',
						type: 'date',
						placeholder: 'End Date',
						value: title.end ? dateFormatInput(title.end) : '',
					}),
				]),
			]),
			this.modalRow([
				this.modalGroup('Services', 'ee_services', [
					services,
					updateAllCheckbox,
					DOM.create('label', { htmlFor: 'scs_updateAll', textContent: 'Update all Services' }),
					deleteAllCheckbox,
					DOM.create('label', { htmlFor: 'scs_deleteAll', textContent: 'Delete old Services on update' }),
				]),
			]),
			DOM.create('div', {
				class: 'group history',
				childs: [
					DOM.create('label', {
						textContent: 'Opened Chapters',
						title: 'Click to show the Chapter List for the Title.',
						childs: [DOM.space(), showHistory],
						events: {
							click: (event) => {
								event.preventDefault();
								showHistory.classList.toggle('fa-angle-down');
								showHistory.classList.toggle('fa-angle-up');
								if (history.classList.toggle('visible')) {
									modal.body.scrollTo({ top: modal.body.scrollHeight, behavior: 'smooth' });
								}
							},
						},
					}),
					history,
				],
			}),
			realSubmit
		);
		// Submit event
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			modal.disableExit();
			cancelButton.disabled = true;
			submitButton.disabled = true;
			deleteButton.disabled = true;
			submitButton.classList.add('loading');

			// Chapter and Status always required
			const state = {
				status: parseInt(form.status.value),
				chapters: historyChapters.map((h) => h.chapter),
				progress: {
					chapter: ((c) => {
						return !isNaN(c) && c > -1 ? c : 0;
					})(parseFloat(form.chapter.value)),
					volume: ((v) => {
						return !isNaN(v) && v > -1 ? v : undefined;
					})(parseInt(form.volume.value)),
				},
				name: form.mediaName.value.trim(),
				score: ((s) => {
					return !isNaN(s) && s >= 0 ? s : 0;
				})(parseInt(form.score.value)),
				// Start - YYYY-MM-DD, convert month from 1-12 to 0-11
				start: ((d) => {
					if (d != '') {
						const parts = d.split('-');
						return new Date(parts[0], parts[1] - 1, parts[2]);
					}
					return undefined;
				})(form.start.value),
				end: ((d) => {
					if (d != '') {
						const parts = d.split('-');
						return new Date(parts[0], parts[1] - 1, parts[2]);
					}
					return undefined;
				})(form.end.value),
				services: {},
			} as TitleEditorState;
			// Services
			for (const key of Object.values(ActivableKey)) {
				state.services[key] = this.service(form, key);
			}
			// updateAllCheckbox.checked
			await syncModule.syncAll(state, {
				deleteOld: deleteAllCheckbox.checked,
				updateExternals: updateAllCheckbox.checked,
			});

			modal.remove();
			modal.enableExit();
		});
		submitButton.addEventListener('click', (event) => {
			event.preventDefault();
			realSubmit.click();
		});
		modal.body.appendChild(form);
		const deleteButton = DOM.create('button', {
			class: 'danger',
			childs: [DOM.icon('trash'), DOM.text('Delete')],
		});
		let timeout: number = -1;
		let notification: SimpleNotification;
		deleteButton.addEventListener('click', async (event) => {
			event.preventDefault();
			// Confirm before deleting
			if (timeout < 0) {
				notification = SimpleNotification.warning(
					{
						title: 'Confirm',
						text: 'Click the **Delete** button again to confirm.',
					},
					{ position: 'bottom-center', duration: 4000, pauseOnHover: false }
				);
				timeout = setTimeout(() => {
					timeout = -1;
				}, 4000);
				return;
			}
			// Clear
			if (notification) notification.remove();
			clearTimeout(timeout);
			// Remove exit
			modal.disableExit();
			cancelButton.disabled = true;
			submitButton.disabled = true;
			deleteButton.disabled = true;
			deleteButton.classList.add('loading');
			await syncModule.delete();
			modal.remove();
			modal.enableExit();
		});
		DOM.append(
			modal.footer,
			DOM.create('div', { childs: [submitButton, cancelButton] }),
			DOM.create('div', { childs: [deleteButton] })
		);
		return modal;
	}
}

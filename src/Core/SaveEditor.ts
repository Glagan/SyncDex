import { ServiceKey, ActivableName, StatusMap, Title } from './Title';
import { DOM, AppendableElement } from './DOM';
import { Modal } from './Modal';
import { GetService } from '../SyncDex/Service';
import { dateFormatInput } from './Utility';
import { Runtime } from './Runtime';
import { Options } from './Options';

export class SaveEditor {
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
			const option = DOM.create('option', { textContent: status, value: `${value}` });
			if (title.status == value++) option.selected = true;
			select.appendChild(option);
		}
		return select;
	}

	static create(title: Title, postSubmit?: () => void): Modal {
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
		for (const sn in ActivableName) {
			const serviceName = sn as ActivableName;
			const serviceKey = ServiceKey[serviceName];
			const link = DOM.create('a', {
				href: '#',
				title: serviceName,
				childs: [DOM.create('img', { src: Runtime.icon(serviceKey), title: serviceName })],
			});
			if (title.services[serviceKey]) {
				link.href = GetService(serviceName).link(title.services[serviceKey]!);
				link.target = '_blank';
			}
			services.appendChild(
				DOM.create('div', {
					class: 'service',
					childs: [link, DOM.space(), ...GetService(serviceName).SaveInput(title.services[serviceKey]!)],
				})
			);
		}
		// Create form with every rows
		const form = DOM.create('form', { class: 'save-entry', name: 'entry-form' });
		const realSubmit = DOM.create('button', {
			type: 'submit',
			css: { display: 'none' },
		});
		DOM.append(
			form,
			this.modalRow([
				this.modalGroup('MangaDex', '', [
					DOM.create('span', { class: 'helper', textContent: `# ${title.id}` }),
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
			this.modalRow([
				this.modalGroup('Chapter', 'ee_chapter', [
					DOM.create('input', {
						id: 'ee_chapter',
						name: 'chapter',
						type: 'number',
						placeholder: 'Chapter',
						value: `${title.progress.chapter}`,
						required: true,
					}),
				]),
				this.modalGroup('Volume', 'ee_volume', [
					DOM.create('input', {
						id: 'ee_volume',
						name: 'volume',
						type: 'number',
						placeholder: 'Volume',
						value: title.progress.volume ? `${title.progress.volume}` : '',
					}),
				]),
			]),
			this.modalRow([
				this.modalGroup('Status', 'status', [this.statusOptions(title)]),
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
			DOM.create('label', { textContent: 'Services' }),
			services,
			realSubmit
		);
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			modal.disableExit();
			cancelButton.disabled = true;
			submitButton.disabled = true;
			submitButton.classList.add('loading');
			// Chapter and Status always required
			let oldChapter = title.progress.chapter;
			let chapter = parseFloat(form.chapter.value);
			if (!isNaN(chapter) && chapter > -1) title.progress.chapter = chapter;
			else chapter = 0;
			title.status = parseInt(form.status.value);
			// Update Chapter list
			if (Options.saveOpenedChapters && oldChapter != title.progress.chapter) {
				title.updateChapterList(chapter);
			}
			title.progress.chapter = chapter;
			// Volume
			if (form.volume.value != '') {
				const volume = parseInt(form.volume.value);
				if (!isNaN(volume) && volume > -1) title.progress.volume = volume;
			} else delete title.progress.volume;
			// Name
			if (form.mediaName.value != '') title.name = (form.mediaName.value as string).trim();
			else delete title.name;
			// Score
			if (form.score.value != '') {
				const score = parseInt(form.score.value);
				if (!isNaN(score) && score >= 0) title.score = score;
			} else title.score = 0;
			// Start - YYYY-MM-DD, convert month from 1-12 to 0-11
			if (form.start.value != '') {
				const parts: number[] = (form.start.value as string).split('-').map((p) => parseInt(p));
				title.start = new Date(parts[0], parts[1] - 1, parts[2]);
			} else delete title.start;
			// End - YYYY-MM-DD
			if (form.end.value != '') {
				const parts: number[] = (form.end.value as string).split('-').map((p) => parseInt(p));
				title.end = new Date(parts[0], parts[1] - 1, parts[2]);
			} else delete title.end;
			// Services
			for (const sn in ActivableName) {
				GetService(sn as ActivableName).HandleInput(title, form);
			}
			// Save and close Modal
			await title.persist();
			SimpleNotification.info({ title: 'Title Saved' });
			submitButton.classList.remove('loading');
			modal.enableExit();
			modal.remove();
			if (postSubmit) postSubmit();
		});
		submitButton.addEventListener('click', (event) => {
			event.preventDefault();
			realSubmit.click();
		});
		modal.body.appendChild(form);
		DOM.append(modal.footer, submitButton, cancelButton);
		return modal;
	}
}

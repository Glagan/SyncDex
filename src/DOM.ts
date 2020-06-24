type DOMSimpleEvent<K extends keyof DocumentEventMap> = (ev: DocumentEventMap[K]) => any;
export type AppendableElement = HTMLElement | Text;
interface DOMProperties {
	textContent?: string;
	class?: string;
	classList?: string[];
	style?: { [key in keyof Partial<CSSStyleDeclaration>]: string };
	attributes?: { [key: string]: string };
	childs?: AppendableElement[];
	events?: {
		[key in keyof Partial<DocumentEventMap>]: DOMSimpleEvent<key>;
	};
	dataset?: Record<string, string>;
}

type PhotonIcon =
	| 'arrow-right'
	| 'brush'
	| 'cancel'
	| 'check'
	| 'delete-light'
	| 'delete'
	| 'download'
	| 'globe'
	| 'history'
	| 'import-export'
	| 'info'
	| 'library'
	| 'login-light'
	| 'new-light'
	| 'new'
	| 'preferences'
	| 'reminders'
	| 'sync'
	| 'underflow-light'
	| 'underflow'
	| 'upload'
	| 'external-light'
	| 'external'
	| 'warning';

export class DOM {
	static create<K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		properties?: DOMProperties
	): HTMLElementTagNameMap[K] {
		const elt = document.createElement(tagName);
		if (properties) {
			Object.assign(elt, {
				textContent: properties.textContent || '',
				className: properties.class || '',
			});
			if (properties.classList) {
				for (const className of properties.classList) {
					elt.classList.add(className);
				}
			}
			if (properties.style) {
				Object.assign(elt.style, properties.style);
			}
			if (properties.attributes) {
				for (const key in properties.attributes) {
					if (properties.attributes.hasOwnProperty(key)) {
						const attr = properties.attributes[key];
						elt.setAttribute(key, attr);
					}
				}
			}
			if (properties.childs) {
				for (const child in properties.childs) {
					if (properties.childs.hasOwnProperty(child)) {
						elt.appendChild(properties.childs[child]);
					}
				}
			}
			if (properties.events) {
				for (const event in properties.events) {
					if (properties.events.hasOwnProperty(event)) {
						elt.addEventListener(
							event,
							(<K extends keyof DocumentEventMap>(event: string): DOMSimpleEvent<K> => {
								return properties.events[event as K] as DOMSimpleEvent<K>;
							})(event)
						);
					}
				}
			}
			if (properties.dataset) {
				for (const data in properties.dataset) {
					if (properties.dataset.hasOwnProperty(data)) {
						elt.dataset[data] = properties.dataset[data];
					}
				}
			}
		}
		return elt;
	}

	static text(text: string | undefined = undefined): Text {
		return document.createTextNode(!text ? '' : text);
	}

	static space(): Text {
		return this.text('\xA0');
	}

	static icon(icon: PhotonIcon): HTMLElement {
		return DOM.create('img', {
			attributes: {
				src: `icons/${icon}.svg`,
			},
		});
	}

	static clear(node: HTMLElement) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}

	static append(parent: HTMLElement, ...childs: AppendableElement[]): HTMLElement {
		for (const child of childs) {
			parent.appendChild(child);
		}
		return parent;
	}
}

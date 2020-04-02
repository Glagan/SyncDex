type DOMSimpleEvent<K extends keyof DocumentEventMap> = (ev: DocumentEventMap[K]) => any;
interface DOMProperties {
	textContent?: string;
	class?: string;
	classList?: string[];
	style?: { [key in keyof Partial<CSSStyleDeclaration>]: string };
	attributes?: { [key: string]: string };
	childs?: (HTMLElement | Text)[];
	events?: {
		[key in keyof Partial<DocumentEventMap>]: DOMSimpleEvent<key>;
	};
	dataset?: Record<string, string>;
}

export class DOM {
	static create<K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		properties?: DOMProperties
	): HTMLElementTagNameMap[K] {
		const elt = document.createElement(tagName);
		if (properties) {
			Object.assign(elt, {
				textContent: properties.textContent || '',
				className: properties.class || ''
			});
			if (properties.classList) {
				for (let index = 0; index < properties.classList.length; index++) {
					const className = properties.classList[index];
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
							(<K extends keyof DocumentEventMap>(
								event: string
							): DOMSimpleEvent<K> => {
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

	static clear(node: HTMLElement) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}

	static append(parent: HTMLElement, ...childs: (HTMLElement | Text)[]): HTMLElement {
		for (let index = 0; index < childs.length; index++) {
			const child = childs[index];
			parent.appendChild(child);
		}
		return parent;
	}
}

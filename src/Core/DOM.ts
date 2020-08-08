type DOMSimpleEvent<K extends keyof DocumentEventMap> = (ev: DocumentEventMap[K]) => any;
export type AppendableElement = HTMLElement | Text;
interface DOMProperties {
	textContent: string;
	class: string;
	// classList: string[];
	css: Partial<{ [key in keyof CSSStyleDeclaration]: string }>;
	childs: AppendableElement[];
	events: Partial<{ [key in keyof DocumentEventMap]: DOMSimpleEvent<key> }>;
	dataset: DOMStringMap;
}

export class DOM {
	static create<K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		properties?: Partial<HTMLElementTagNameMap[K]> & Partial<DOMProperties>
	): HTMLElementTagNameMap[K] {
		const elt = document.createElement(tagName);
		// Automatically add rel to all links
		if (tagName === 'a') (elt as HTMLAnchorElement).rel = 'noreferrer noopener';
		// Add all other properties
		if (properties) {
			Object.assign(elt, properties);
			if (properties.textContent) {
				elt.textContent = properties.textContent;
			}
			if (properties.class) {
				elt.className = properties.class;
			}
			/*if (properties.classList) {
				for (const className of properties.classList) {
					elt.classList.add(className);
				}
			}*/
			if (properties.style) {
				Object.assign(elt.style, properties.style);
			}
			if (properties.childs) {
				DOM.append(elt, ...properties.childs);
			}
			if (properties.events) {
				for (const event in properties.events) {
					elt.addEventListener(
						event,
						(<K extends keyof DocumentEventMap>(event: string): DOMSimpleEvent<K> => {
							return properties.events[event as K] as DOMSimpleEvent<K>;
						})(event)
					);
				}
			}
			if (properties.dataset) {
				Object.assign(elt.dataset, properties.dataset);
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

	static icon(icon: string): HTMLElement {
		return DOM.create('i', {
			class: `fas fa-${icon}`,
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

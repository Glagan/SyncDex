interface DOMProperties {
	textContent?: string;
	class?: string;
	classList?: string[];
	style?: { [key in keyof Partial<CSSStyleDeclaration>]: string };
	attributes?: { [key: string]: string };
}

export class DOM {
	static create<K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		properties?: DOMProperties
	): HTMLElementTagNameMap[K] {
		const elt = document.createElement(tagName);
		if (properties) {
			if (properties.textContent) {
				elt.textContent = properties.textContent;
			}
			if (properties.class) {
				elt.className = properties.class;
			}
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
		}
		return elt;
	}

	static clear(node: HTMLElement) {
		while (node.firstChild) {
			node.removeChild(node.firstChild);
		}
	}

	static append(parent: HTMLElement, ...childs: HTMLElement[]): HTMLElement {
		for (let index = 0; index < childs.length; index++) {
			const child = childs[index];
			parent.appendChild(child);
		}
		return parent;
	}
}

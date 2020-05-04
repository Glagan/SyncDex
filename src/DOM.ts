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

type LineIcons =
	| 'add-files'
	| 'alarm-clock'
	| 'alarm'
	| 'anchor'
	| 'android-original'
	| 'android'
	| 'angle-double-down'
	| 'angle-double-left'
	| 'angle-double-right'
	| 'angle-double-up'
	| 'apartment'
	| 'archive'
	| 'arrow-down-circle'
	| 'arrow-left-circle'
	| 'arrow-left'
	| 'arrow-right-circle'
	| 'arrow-right'
	| 'arrow-top-left'
	| 'arrow-top-right'
	| 'arrow-up-circle'
	| 'arrow-up'
	| 'arrows-horizontal'
	| 'arrows-vertical'
	| 'arrow-down'
	| 'ambulance'
	| 'agenda'
	| 'backward'
	| 'baloon'
	| 'ban'
	| 'bar-chart'
	| 'blackboard'
	| 'bluetooth'
	| 'bold'
	| 'bolt-alt'
	| 'bolt'
	| 'book'
	| 'bookmark-alt'
	| 'bookmark'
	| 'bricks'
	| 'bridge'
	| 'briefcase'
	| 'brush-alt'
	| 'brush'
	| 'bubble'
	| 'bug'
	| 'bulb'
	| 'bullhorn'
	| 'burger'
	| 'bus'
	| 'cake'
	| 'calculator'
	| 'calendar'
	| 'camera'
	| 'candy-cane'
	| 'candy'
	| 'capsule'
	| 'car-alt'
	| 'car'
	| 'caravan'
	| 'cart-full'
	| 'cart'
	| 'certificate'
	| 'checkbox'
	| 'checkmark-circle'
	| 'checkmark'
	| 'chef-hat'
	| 'chevron-down-circle'
	| 'chevron-down'
	| 'chevron-left-circle'
	| 'chevron-left'
	| 'chevron-right-circle'
	| 'chevron-right'
	| 'chevron-up-circle'
	| 'chevron-up'
	| 'chrome'
	| 'circle-minus'
	| 'circle-plus'
	| 'clipboard'
	| 'close'
	| 'cloud-check'
	| 'cloud-download'
	| 'cloud-network'
	| 'cloud-sync'
	| 'cloud-upload'
	| 'cloud'
	| 'cloudy-sun'
	| 'code-alt'
	| 'code'
	| 'coffee-cup'
	| 'cog'
	| 'cogs'
	| 'coin'
	| 'comments-alt'
	| 'comments-reply'
	| 'comments'
	| 'compass'
	| 'construction-hammer'
	| 'construction'
	| 'consulting'
	| 'control-panel'
	| 'creative-commons'
	| 'credit-cards'
	| 'crop'
	| 'cross-circle'
	| 'crown'
	| 'cup'
	| 'customer'
	| 'cut'
	| 'dashboard'
	| 'database'
	| 'delivery'
	| 'diamond-alt'
	| 'diamond'
	| 'dinner'
	| 'direction-alt'
	| 'direction-ltr'
	| 'direction-rtl'
	| 'direction'
	| 'discord'
	| 'display-alt'
	| 'display'
	| 'dollar'
	| 'domain'
	| 'download'
	| 'drop'
	| 'dropbox-original'
	| 'dropbox'
	| 'dumbbell'
	| 'edge'
	| 'emoji-cool'
	| 'emoji-friendly'
	| 'emoji-happy'
	| 'emoji-sad'
	| 'emoji-smile'
	| 'emoji-speechless'
	| 'emoji-suspect'
	| 'emoji-tounge'
	| 'empty-file'
	| 'enter'
	| 'envelope'
	| 'eraser'
	| 'euro'
	| 'exit-down'
	| 'exit-up'
	| 'exit'
	| 'eye'
	| 'files'
	| 'firefox-original'
	| 'firefox'
	| 'fireworks'
	| 'first-aid'
	| 'flag-alt'
	| 'flag'
	| 'flags'
	| 'basketball'
	| 'forward'
	| 'frame-expand'
	| 'flower'
	| 'full-screen'
	| 'funnel'
	| 'gallery'
	| 'game'
	| 'gift'
	| 'git'
	| 'github-original'
	| 'github'
	| 'google-drive'
	| 'fresh-juice'
	| 'folder'
	| 'bi-cycle'
	| 'graph'
	| 'grid-alt'
	| 'grid'
	| 'grow'
	| 'hammer'
	| 'hand'
	| 'handshake'
	| 'harddrive'
	| 'headphone-alt'
	| 'headphone'
	| 'heart-filled'
	| 'heart-monitor'
	| 'heart'
	| 'helicopter'
	| 'helmet'
	| 'help'
	| 'highlight-alt'
	| 'highlight'
	| 'home'
	| 'hospital'
	| 'hourglass'
	| 'image'
	| 'inbox'
	| 'indent-decrease'
	| 'indent-increase'
	| 'infinite'
	| 'information'
	| 'invention'
	| 'graduation'
	| 'invest-monitor'
	| 'island'
	| 'italic'
	| 'juice'
	| 'key'
	| 'keyboard'
	| 'keyword-research'
	| 'layers'
	| 'layout'
	| 'leaf'
	| 'library'
	| 'licencse'
	| 'life-ring'
	| 'line-dashed'
	| 'line-dotted'
	| 'line-double'
	| 'line-spacing'
	| 'lineicons-alt'
	| 'lineicons'
	| 'link'
	| 'list'
	| 'lock-alt'
	| 'lock'
	| 'magnet'
	| 'magnifier'
	| 'map-marker'
	| 'map'
	| 'mashroom'
	| 'medall-alt'
	| 'medall'
	| 'laptop'
	| 'investment'
	| 'laptop-phone'
	| 'mic'
	| 'microphone'
	| 'menu'
	| 'microscope'
	| 'money-location'
	| 'minus'
	| 'mobile'
	| 'more-alt'
	| 'mouse'
	| 'move'
	| 'music'
	| 'network'
	| 'night'
	| 'notepad'
	| 'offer'
	| 'opera'
	| 'package'
	| 'page-break'
	| 'pagination'
	| 'paint-bucket'
	| 'paint-roller'
	| 'pallet'
	| 'paperclip'
	| 'more'
	| 'pause'
	| 'paypal-original'
	| 'money-protection'
	| 'pencil'
	| 'paypal'
	| 'pencil-alt'
	| 'patreon'
	| 'phone-set'
	| 'phone'
	| 'pin'
	| 'pie-chart'
	| 'pilcrow'
	| 'plane'
	| 'play'
	| 'plug'
	| 'plus'
	| 'pointer-down'
	| 'pointer-left'
	| 'pointer-right'
	| 'pointer-up'
	| 'pizza'
	| 'postcard'
	| 'pound'
	| 'power-switch'
	| 'printer'
	| 'protection'
	| 'pulse'
	| 'pyramids'
	| 'pointer'
	| 'popup'
	| 'quotation'
	| 'radio-button'
	| 'rain'
	| 'question-circle'
	| 'reddit'
	| 'reload'
	| 'restaurant'
	| 'road'
	| 'rocket'
	| 'rss-feed'
	| 'ruler-alt'
	| 'ruler-pencil'
	| 'ruler'
	| 'rupee'
	| 'save'
	| 'school-bench-alt'
	| 'school-bench'
	| 'scooter'
	| 'scroll-down'
	| 'search-alt'
	| 'search'
	| 'select'
	| 'seo'
	| 'service'
	| 'share-alt'
	| 'share'
	| 'shield'
	| 'shift-left'
	| 'shift-right'
	| 'ship'
	| 'shopping-basket'
	| 'shortcode'
	| 'shovel'
	| 'shuffle'
	| 'signal'
	| 'skipping-rope'
	| 'slice'
	| 'slim'
	| 'reply'
	| 'sort-alpha-asc'
	| 'remove-file'
	| 'sort-amount-dsc'
	| 'sort-amount-asc'
	| 'spiner-solid'
	| 'revenue'
	| 'spinner'
	| 'spellcheck'
	| 'spray'
	| 'sprout'
	| 'stamp'
	| 'star-empty'
	| 'star-filled'
	| 'star-half'
	| 'star'
	| 'stats-down'
	| 'spinner-arrow'
	| 'stop'
	| 'strikethrough'
	| 'sthethoscope'
	| 'sun'
	| 'support'
	| 'surf-board'
	| 'syringe'
	| 'tab'
	| 'tag'
	| 'target-customer'
	| 'target-revenue'
	| 'target'
	| 'taxi'
	| 'stats-up'
	| 'text-align-center'
	| 'text-align-justify'
	| 'text-align-left'
	| 'text-format-remove'
	| 'text-align-right'
	| 'text-format'
	| 'thought'
	| 'thumbs-down'
	| 'thumbs-up'
	| 'thunder-alt'
	| 'thunder'
	| 'ticket-alt'
	| 'ticket'
	| 'timer'
	| 'train-alt'
	| 'train'
	| 'trash'
	| 'travel'
	| 'tree'
	| 'trees'
	| 'trowel'
	| 'tshirt'
	| 'underline'
	| 'unlink'
	| 'unlock'
	| 'upload'
	| 'user'
	| 'users'
	| 'ux'
	| 'vector'
	| 'video'
	| 'volume-high'
	| 'volume-low'
	| 'volume-medium'
	| 'volume-mute'
	| 'volume'
	| 'wallet'
	| 'warning'
	| 'website-alt'
	| 'website'
	| 'weight'
	| 'wheelbarrow'
	| 'wheelchair'
	| 'world-alt'
	| 'world'
	| 'write'
	| 'yen'
	| 'zip'
	| 'zoom-in'
	| 'zoom-out'
	| 'teabag';

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

	static icon(icon: LineIcons): HTMLElement {
		return DOM.create('i', {
			class: `lni lni-${icon}`,
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

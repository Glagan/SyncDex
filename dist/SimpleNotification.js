/**
 * @typedef {('top-left' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right')} Position
 */

/**
 * @typedef {('success' | 'info' | 'error' | 'warning' | 'message')} Type
 */

/**
 * @typedef InsertAnimationDefinition
 * @type {object}
 * @property {('default-insert'
			| 'insert-left'
			| 'insert-right'
			| 'insert-top'
			| 'insert-bottom'
			| 'fadein'
			| 'scalein'
			| 'rotatein')} name
 * @property {number} duration - in ms
 */

/**
 * @typedef RemoveAnimationDefinition
 * @type {object}
 * @property {('fadeout' | 'scaleout' | 'rotateout')} name
 * @property {number} duration - in ms
 */

/**
 * @typedef EventCallback
 * @type {function}
 * @param {SimpleNotification} notification
 * @returns {void}
 */

/**
 * @typedef OnCloseCallback
 * @type {function}
 * @param {SimpleNotification} notification
 * @param {boolean} [fromUser=false]
 * @returns {void}
 */

/**
 * @typedef Events
 * @type {object}
 * @property {EventCallback} [onCreate];
 * @property {EventCallback} [onDisplay];
 * @property {EventCallback} [onDeath];
 * @property {OnCloseCallback} [onClose];
 */

/**
 * @typedef Options
 * @type {object}
 * @property {Position} position
 * @property {number} maxNotifications
 * @property {boolean} removeAllOnDisplay
 * @property {boolean} pauseOnHover
 * @property {boolean} closeOnClick
 * @property {boolean} closeButton
 * @property {number} duration
 * @property {boolean} sticky
 * @property {Events} events
 * @property {InsertAnimationDefinition} insertAnimation
 * @property {RemoveAnimationDefinition} removeAnimation
 */

/**
 * @typedef Button
 * @type {object}
 * @property {Type} [type]
 * @property {string} [value]
 * @property {EventCallback} [onClick]
 */

/**
 * @typedef Content
 * @type {object}
 * @property {string} [image]
 * @property {string} [text]
 * @property {string} [title]
 * @property {Button[]} [buttons]
 */

/**
 * @typedef TagDescription
 * @type {object}
 * @property {string} type
 * @property {string} class
 * @property {string} open
 * @property {string} close
 * @property {{ textContent: string | boolean } & Object.<string, number>} attributes
 * @property {string} textContent
 */

class SimpleNotification {
	/**
	 * @param {Partial<Options>} [options]
	 */
	constructor(options = undefined) {
		/** @type {DocumentFragment} */
		this.fragment = new DocumentFragment();
		/** @type {Options} */
		this.options = options;
		if (this.options == undefined) {
			this.options = SimpleNotification.deepAssign({}, SimpleNotification._options);
		}
		/** @type {Events} */
		this.events = this.options.events;
		/** @type {HTMLElement | undefined} */
		this.node = undefined;
		// Content
		/** @type {string | undefined} */
		this.title = undefined;
		/** @type {HTMLElement | undefined} */
		this.closeButton = undefined;
		/** @type {HTMLElement | undefined} */
		this.body = undefined;
		/** @type {HTMLImageElement | undefined} */
		this.image = undefined;
		/** @type {string | undefined} */
		this.text = undefined;
		/** @type {HTMLElement | undefined} */
		this.buttons = undefined;
		/** @type {HTMLElement | undefined} */
		this.progressBar = undefined;
		// Functions
		/** @type {() => void} */
		this.addExtinguish = this.addExtinguishFct.bind(this);
		/** @type {() => void} */
		this.removeExtinguish = this.removeExtinguishFct.bind(this);
	}

	/**
	 * @param {object} target
	 * @param {object[]} objs
	 * @returns {object}
	 */
	static deepAssign(target, ...objs) {
		for (let i = 0, max = objs.length; i < max; i++) {
			for (var k in objs[i]) {
				if (objs[i][k] != null && typeof objs[i][k] == 'object')
					target[k] = SimpleNotification.deepAssign(target[k] ? target[k] : {}, objs[i][k]);
				else target[k] = objs[i][k];
			}
		}
		return target;
	}

	/**
	 * Set the default options of SimpleNotification
	 * @param {Partial<Options>} options Options object to override the defaults
	 */
	static options(options) {
		SimpleNotification._options = SimpleNotification.deepAssign({}, SimpleNotification._options, options);
	}

	/**
	 * Create a wrapper and add it to the wrappers object
	 * Valid default position: top-left, top-right, bottom-left, bottom-center, bottom-right
	 * @param {string} position The position of the wrapper
	 */
	static makeWrapper(position) {
		let wrapper = document.createElement('div');
		wrapper.className = `gn-wrapper gn-${position}`;
		document.body.appendChild(wrapper);
		SimpleNotification.wrappers[position] = wrapper;
	}

	/**
	 * Search the first occurence of the char occurence in text that doesn't have a \ prefix
	 * @param {string} text The text where to search the char in
	 * @param {string} char The string to search in the text
	 * @param {number} start The position to begin to search with
	 * @returns {number | undefined}
	 */
	static firstUnbreakChar(text, char, start = 0) {
		if (start < 0) start = 0;
		let foundPos;
		while (start >= 0) {
			foundPos = text.indexOf(char, start);
			if (foundPos > 0 && text[foundPos - 1] == '\\') {
				start = foundPos + 1;
			} else {
				start = -1;
			}
		}
		return foundPos;
	}

	/**
	 * Search the first shortest occurence of token in the string array string after position start in the current string
	 * @param {string} string
	 * @param {string} token
	 * @param {number} start
	 * @returns {[number, number]}
	 */
	static searchToken(string, token, start) {
		let found = [start[0], start[1]];
		for (let max = string.length; found[0] < max; found[0]++) {
			if (typeof string[found[0]] == 'string' && (found[1] = string[found[0]].indexOf(token, found[1])) > -1) {
				return found;
			}
			found[1] = 0;
		}
		return [-1, -1];
	}

	/**
	 * Break a string with a `tag` element at position start until end
	 * @param {string} string
	 * @param {TagDescription} tag
	 * @param {string} token
	 * @param {number} start
	 * @returns {[number, number]}
	 */
	static breakString(string, tag, start, end) {
		let tagLength = { open: tag.open.length, close: tag.close.length };
		if (start[0] != end[0]) {
			let inside = { tag: tag, str: [string[start[0]].substring(start[1])] };
			let c = 0;
			for (let i = start[0] + 1; i < end[0]; i++, c++) {
				inside.str.push(string[i]);
			}
			inside.str.push(string[end[0]].substring(0, end[1]));
			inside.str = [this.joinString(inside.str)];
			string.splice(start[0] + 1, c, inside);
			end[0] = start[0] + 2;
			string[start[0]] = string[start[0]].substring(0, start[1] - tagLength.open);
			string[end[0]] = string[end[0]].substring(end[1] + tagLength.close);
			return [end[0], 0];
		} else {
			string.splice(
				start[0] + 1,
				0,
				{ tag: tag, str: [string[start[0]].substring(start[1], end[1])] },
				string[start[0]].substring(end[1] + tagLength.close)
			);
			string[start[0]] = string[start[0]].substring(0, start[1] - tagLength.open);
			return [start[0] + 2, 0];
		}
	}

	/**
	 * Recursive string array concatenation
	 * @param {string[]} arr
	 * @returns {string}
	 */
	static joinString(arr) {
		let str = [];
		for (let i = 0, max = arr.length; i < max; i++) {
			if (typeof arr[i] == 'string') {
				str.push(arr[i]);
			} else {
				str.push(arr[i].tag.open);
				str.push(this.joinString(arr[i].str));
				str.push(arr[i].tag.close);
			}
		}
		return str.join('');
	}

	/**
	 * Make the node body by build each of it's childrens
	 * @param {string} string
	 * @param {HTMLElement} node
	 * @returns {HTMLElement}
	 */
	static buildNode(string, node) {
		for (let i = 0; i < string.length; i++) {
			if (typeof string[i] == 'string') {
				if (string[i].length > 0) {
					node.appendChild(document.createTextNode(string[i]));
				}
			} else {
				let tagInfo = string[i].tag;
				let tag = document.createElement(tagInfo.type);
				if (tagInfo.type == 'a' || tagInfo.type == 'button') {
					tag.addEventListener('click', (event) => {
						event.stopPropagation();
					});
				}
				// Content
				let title;
				let content = this.joinString(string[i].str);
				if ('title' in tagInfo && tagInfo.title && content.length > 0) {
					if (content.indexOf('!') == 0) {
						content = content.substring(1);
					} else {
						// find |
						let foundTitleBreak = this.firstUnbreakChar(content, '|');
						content = content.replace('\\|', '|');
						if (foundTitleBreak > -1) {
							title = content.substring(0, foundTitleBreak);
							content = content.substring(foundTitleBreak + 1);
						}
					}
				}
				if (title == undefined) {
					title = content;
				}
				// Set attributes
				if ('attributes' in tagInfo) {
					let keys = Object.keys(tagInfo.attributes);
					for (let k = 0, max = keys.length; k < max; k++) {
						let attributeValue = tagInfo.attributes[keys[k]]
							.replace('$content', content)
							.replace('$title', title);
						tag.setAttribute(keys[k], attributeValue);
					}
				}
				if (tagInfo.textContent) {
					tag.textContent = tagInfo.textContent.replace('$content', content).replace('$title', title);
				} else if (tagInfo.textContent != false) {
					this.textToNode(string[i].str, tag);
				}
				// Set a class if defined
				if (tagInfo.class) {
					if (Array.isArray(tagInfo.class)) {
						for (let i = 0, max = tagInfo.class.length; i < max; i++) {
							tag.classList.add(tagInfo.class[i]);
						}
					} else {
						tag.className = tagInfo.class;
					}
				}
				node.appendChild(tag);
			}
		}
		return node;
	}

	/**
	 * Transform a text with tags to a DOM node
	 * {open}{content}{close}
	 * {open}{!|title|}{content}{close} | is the title/content separator
	 * @param {string} text The text with tags
	 * @param {object} node The node where the text will be added
	 * @returns {HTMLElement | undefined}
	 */
	static textToNode(text, node) {
		if (text == undefined) return;
		let string;
		if (Array.isArray(text)) {
			string = text;
		} else {
			// Normalize linebreak
			text = text.replace(/(\r?\n|\r)/gm, '\n');
			string = [text];
		}
		// Break string by tokens
		if (this.tokens == undefined || this.refreshTokens != undefined) {
			this.tokens = Object.keys(SimpleNotification.tags);
			this.refreshTokens = undefined;
		}
		for (let i = 0, last = this.tokens.length; i < last; i++) {
			let tag = SimpleNotification.tags[this.tokens[i]];
			let tagLength = { open: tag.open.length, close: tag.close.length };
			let continueAt = [0, 0];
			let openPos = [0, 0];
			let closePos = [0, 0];
			while ((openPos = this.searchToken(string, tag.open, continueAt))[0] > -1) {
				openPos[1] += tagLength.open;
				if ((closePos = this.searchToken(string, tag.close, openPos))[0] > -1) {
					continueAt = this.breakString(string, tag, openPos, closePos);
				} else {
					continueAt = openPos;
				}
			}
		}
		return this.buildNode(string, node);
	}

	/**
	 * Create the notification node, set it's classes and call the onCreate event
	 * @param {string[]} classes
	 */
	make(classes) {
		this.node = document.createElement('div');
		this.fragment.appendChild(this.node);
		// Apply Style
		this.node.className = 'gn-notification gn-insert';
		if (this.options.insertAnimation.name == 'default-insert') {
			switch (this.options.position) {
				case 'top-left':
				case 'bottom-left':
					this.options.insertAnimation.name = 'insert-left';
					break;
				case 'top-right':
				case 'bottom-right':
					this.options.insertAnimation.name = 'insert-right';
					break;
				case 'top-center':
					this.options.insertAnimation.name = 'insert-top';
					break;
				case 'bottom-center':
					this.options.insertAnimation.name = 'insert-bottom';
					break;
			}
		}
		if (this.options.insertAnimation.name == this.options.removeAnimation.name) {
			if (this.options.insertAnimation.name == 'fadeout') {
				this.options.removeAnimation.name = 'rotateout';
			} else {
				this.options.removeAnimation.name = 'fadeout';
			}
		}
		this.node.style.animationName = this.options.insertAnimation.name;
		this.node.style.animationDuration = `${this.options.insertAnimation.duration}ms`;
		classes.forEach((className) => {
			this.node.classList.add(className);
		});
		// AnimationEnd listener for the different steps of a notification
		this.node.addEventListener('animationend', (event) => {
			if (event.animationName == this.options.removeAnimation.name) {
				this.close(false);
			} else if (event.animationName == this.options.insertAnimation.name) {
				this.node.classList.remove('gn-insert');
				// Reset notification duration when hovering
				if (!this.options.sticky && this.options.pauseOnHover) {
					this.node.addEventListener('mouseenter', this.removeExtinguish);
					this.node.addEventListener('mouseleave', this.addExtinguish);
				}
				if (this.progressBar) {
					// Set the time before removing the notification
					this.progressBar.style.animationDuration = `${this.options.duration}ms`;
					if (document.hasFocus()) {
						this.progressBar.classList.add('gn-extinguish');
					} else {
						// Start the extinguish animation only when the page is focused
						let addFocusExtinguish = () => {
							this.progressBar.classList.add('gn-extinguish');
							document.removeEventListener('focus', addFocusExtinguish);
						};
						document.addEventListener('focus', addFocusExtinguish);
					}
				}
			} else if (event.animationName == 'shorten' && this.progressBar) {
				if (!this.options.sticky && this.options.pauseOnHover) {
					this.node.removeEventListener('mouseenter', this.removeExtinguish);
					this.node.removeEventListener('mouseleave', this.addExtinguish);
				}
				this.progressBar.classList.add('gn-retire');
				if (this.events.onDeath) {
					this.events.onDeath(this);
				} else {
					this.disableButtons();
					this.closeAnimated();
					// TODO: Add event listener to pause closing
				}
			}
		});
		// Delete the notification on click
		if (this.options.closeOnClick) {
			this.node.title = 'Click to close.';
			this.node.classList.add('gn-close-on-click');
			this.node.addEventListener('click', () => {
				this.close(true);
			});
		}
		// Fire onCreateEvent
		if (this.events.onCreate) {
			this.events.onCreate(this);
		}
	}

	/**
	 * Set the type of the notification
	 * success, info, error, warning, message
	 * It can be another CSS class but `type` will be prepended with `gn-`
	 * @param {Type} type
	 */
	setType(type) {
		if (this.node) {
			let closeOnClick = this.node.classList.contains('gn-close-on-click');
			this.node.className = `gn-notification gn-${type}`;
			if (closeOnClick) {
				this.node.classList.add('gn-close-on-click');
			}
		}
	}

	/**
	 * Set the title of the notification
	 * @param {string} title
	 */
	setTitle(title) {
		if (this.title == undefined) {
			this.title = document.createElement('h1');
			this.node.insertBefore(this.title, this.node.firstElementChild);
			if (this.closeButton) {
				this.title.appendChild(this.closeButton);
			}
		}
		this.title.title = title;
		this.title.textContent = title;
	}

	/**
	 * Add a close button to the top right of the notification
	 */
	addCloseButton() {
		let closeButton = document.createElement('span');
		closeButton.title = 'Click to close.';
		closeButton.className = 'gn-close';
		closeButton.textContent = '\u274C';
		closeButton.addEventListener('click', () => {
			this.close(true);
		});
		if (this.title) {
			closeButton.classList.add('gn-close-title');
			this.title.appendChild(closeButton);
		} else {
			this.node.insertBefore(closeButton, this.node.firstElementChild);
		}
	}

	/**
	 * Add the notification body that contains the notification image and text
	 */
	addBody() {
		this.body = document.createElement('div');
		this.body.className = 'gn-content';
		this.node.appendChild(this.body);
		if (this.buttons) {
			this.node.insertBefore(this.body, this.buttons);
		} else if (this.progressBar) {
			this.node.insertBefore(this.body, this.progressBar);
		} else {
			this.node.appendChild(this.body);
		}
	}

	/**
	 * Set the image src attribute
	 * @param {string} src
	 */
	setImage(src) {
		if (this.image == undefined) {
			this.image = document.createElement('img');
			if (this.text) {
				this.body.insertBefore(this.image, this.text);
			} else {
				if (!this.body) {
					this.addBody();
				}
				this.body.appendChild(this.image);
			}
		}
		this.image.src = src;
	}

	/**
	 * Set the text content of the notification body
	 * @param {string} content
	 */
	setText(content) {
		if (this.text == undefined) {
			this.text = document.createElement('div');
			this.text.className = 'gn-text';
			if (!this.body) {
				this.addBody();
			}
			this.body.appendChild(this.text);
		} else {
			while (this.text.firstChild) {
				this.text.removeChild(this.text.firstChild);
			}
		}
		SimpleNotification.textToNode(content, this.text);
	}

	/**
	 * Add a single button after all already added buttons
	 * @param {Button} options
	 */
	addButton(options) {
		if (!options.type || !options.value) return;
		if (this.buttons == undefined) {
			this.buttons = document.createElement('div');
			this.buttons.className = 'gn-buttons';
			if (this.progressBar) {
				this.node.insertBefore(this.buttons, this.progressBar);
			} else {
				this.node.appendChild(this.buttons);
			}
		}
		let button = document.createElement('button');
		SimpleNotification.textToNode(options.value, button);
		button.className = `gn-button gn-${options.type}`;
		if (options.onClick) {
			button.addEventListener('click', (event) => {
				event.stopPropagation();
				options.onClick(this);
			});
		}
		this.buttons.appendChild(button);
	}

	/**
	 * Remove all buttons
	 */
	removeButtons() {
		if (this.buttons) {
			this.node.removeChild(this.buttons);
			this.buttons = undefined;
		}
	}

	/**
	 * Add the notification progress bar
	 */
	addProgressBar() {
		this.progressBar = document.createElement('span');
		this.progressBar.className = 'gn-lifespan';
		this.node.appendChild(this.progressBar);
	}

	/**
	 * Append the notification body to it's wrapper and call the onDisplay event
	 */
	display() {
		if (this.node) {
			if (this.options.removeAllOnDisplay) {
				SimpleNotification.displayed.forEach((n) => {
					n.remove();
				});
			} else if (this.options.maxNotifications > 0) {
				let diff = -(this.options.maxNotifications - (SimpleNotification.displayed.length + 1));
				if (diff > 0) {
					for (let i = 0, max = diff; i < max; i++) {
						SimpleNotification.displayed[i].remove();
					}
				}
			}
			if (!SimpleNotification.wrappers[this.options.position]) {
				SimpleNotification.makeWrapper(this.options.position);
			}
			SimpleNotification.wrappers[this.options.position].appendChild(this.fragment);
			SimpleNotification.displayed.push(this);
			if (this.events.onDisplay) {
				this.events.onDisplay(this);
			}
		}
	}

	/**
	 * Remove the notification from the screen without calling the onClose event
	 * @returns {boolean}
	 */
	remove() {
		if (this.node != undefined) {
			this.node.remove();
			this.node = undefined;
			let index = SimpleNotification.displayed.indexOf(this);
			if (index) {
				SimpleNotification.displayed.splice(index, 1);
			}
			return true;
		}
		return false;
	}

	/**
	 * Remove the notification from the screen and call the onClose event
	 * @param {boolean} fromUser
	 */
	close(fromUser = false) {
		if (this.remove() && this.events.onClose) {
			this.events.onClose(this, fromUser);
		}
	}

	/**
	 * Remove reset events and add the fadeout animation
	 */
	closeAnimated() {
		// Add the fadeout animation
		this.node.classList.add('gn-remove');
		this.node.style.animationName = this.options.removeAnimation.name;
		this.node.style.animationDuration = `${this.options.removeAnimation.duration}ms`;
		// Pause and reset fadeout on hover
		this.node.addEventListener('mouseenter', (event) => {
			event.target.classList.remove('gn-remove');
		});
		this.node.addEventListener('mouseleave', (event) => {
			event.target.classList.add('gn-remove');
		});
	}

	/**
	 * Add the class 'gn-extinguish' to the event target
	 * Used in create() and closeAnimated() to be able to remove the eventListener.
	 */
	addExtinguishFct() {
		this.progressBar.classList.add('gn-extinguish');
	}

	/**
	 * Remove the class 'gn-extinguish' to the event target
	 * Used in create() and closeAnimated() to be able to remove the eventListener.
	 */
	removeExtinguishFct() {
		this.progressBar.classList.remove('gn-extinguish');
	}

	/**
	 * Add the disabled state to all displayed buttons
	 */
	disableButtons() {
		if (this.buttons) {
			for (let i = 0, max = this.buttons.childNodes.length; i < max; i++) {
				this.buttons.childNodes[i].disabled = true;
			}
		}
	}

	/**
	 * Create and append a notification
	 * content is an object with the keys title, text, image and buttons
	 * Options: duration, fadeout, position
	 * @param {array} classes Array of classes to add to the notification
	 * @param {Content} content The content the notification
	 * @param {Partial<Options>} options The options of the notifications
	 * @returns {SimpleNotification}
	 */
	static create(classes, content, notificationOptions = {}) {
		let hasImage = 'image' in content && content.image,
			hasText = 'text' in content && content.text,
			hasTitle = 'title' in content && content.title,
			hasButtons = 'buttons' in content;
		// Abort if empty
		if (!hasImage && !hasTitle && !hasText && !hasButtons) return;
		// Merge options
		let options = SimpleNotification.deepAssign({}, SimpleNotification._options, notificationOptions);
		// Create the notification
		let notification = new SimpleNotification(options);
		notification.make(classes);
		// Add elements
		if (hasTitle) {
			notification.setTitle(content.title);
		}
		if (options.closeButton) {
			notification.addCloseButton();
		}
		if (hasImage) {
			notification.setImage(content.image);
		}
		if (hasText) {
			notification.setText(content.text);
		}
		if (hasButtons) {
			if (!Array.isArray(content.buttons)) {
				content.buttons = [content.buttons];
			}
			for (let i = 0, max = content.buttons.length; i < max; i++) {
				notification.addButton(content.buttons[i]);
			}
		}
		// Add progress bar if not sticky
		if (!options.sticky) {
			notification.addProgressBar();
		}
		// Display
		if (!('display' in options) || options.display) {
			notification.display();
		}
		return notification;
	}

	/**
	 * Create a notification with the 'success' style
	 * @param {Content} content Content of the notification
	 * @param {Partial<Options>} options Options used for the notification
	 * @returns {SimpleNotification}
	 */
	static success(content, options = {}) {
		return this.create(['gn-success'], content, options);
	}

	/**
	 * Create a notification with the 'info' style
	 * @param {Content} content Content of the notification
	 * @param {Partial<Options>} options Options used for the notification
	 * @returns {SimpleNotification}
	 */
	static info(content, options = {}) {
		return this.create(['gn-info'], content, options);
	}

	/**
	 * Create a notification with the 'error' style
	 * @param {Content} content Content of the notification
	 * @param {Partial<Options>} options Options used for the notification
	 * @returns {SimpleNotification}
	 */
	static error(content, options = {}) {
		return this.create(['gn-error'], content, options);
	}

	/**
	 * Create a notification with the 'warning' style
	 * @param {Content} content Content of the notification
	 * @param {Partial<Options>} options Options used for the notification
	 * @returns {SimpleNotification}
	 */
	static warning(content, options = {}) {
		return this.create(['gn-warning'], content, options);
	}

	/**
	 * Create a notification with the 'message' style
	 * @param {Content} content Content of the notification
	 * @param {Partial<Options>} options Options used for the notification
	 * @returns {SimpleNotification}
	 */
	static message(content, options = {}) {
		return this.create(['gn-message'], content, options);
	}

	/**
	 * Make a notification with custom classes
	 * @param {string[]} classes The classes of the notification
	 * @param {Content} content Content of the notification
	 * @param {Partial<Options>} options Options used for the notification
	 * @returns {SimpleNotification}
	 */
	static custom(classes, content, options = {}) {
		return this.create(classes, content, options);
	}

	/**
	 * Add a tag for the textToNode function
	 * @param {string} name The name of the tag
	 * @param {TagDescription} object The values of the tag
	 */
	static addTag(name, object) {
		this.tags[name] = object;
		this.refreshTokens = true;
	}
}
/**
 * @type {Object.<string, HTMLElement>}
 */
SimpleNotification.wrappers = {};
/**
 * @type {SimpleNotification[]}
 */
SimpleNotification.displayed = [];
/**
 * @type {Options}
 */
SimpleNotification._options = {
	position: 'top-right',
	maxNotifications: 0,
	removeAllOnDisplay: false,
	pauseOnHover: true,
	closeOnClick: true,
	closeButton: true,
	duration: 4000,
	sticky: false,
	events: {
		onCreate: undefined,
		onDisplay: undefined,
		onDeath: undefined,
		onClose: undefined,
	},
	insertAnimation: {
		name: 'default-insert',
		duration: 250,
	},
	removeAnimation: {
		name: 'fadeout',
		duration: 400,
	},
};
/**
 * @type {Object.<string, TagDescription>}
 */
SimpleNotification.tags = {
	code: {
		type: 'code',
		class: 'gn-code',
		open: '``',
		close: '``',
		textContent: '$content',
	},
	header2: {
		type: 'h2',
		class: 'gn-header',
		open: '## ',
		close: '\n',
	},
	header1: {
		type: 'h1',
		class: 'gn-header',
		open: '# ',
		close: '\n',
	},
	image: {
		type: 'img',
		title: true,
		attributes: {
			src: '$content',
			title: '$title',
		},
		textContent: false,
		open: '![',
		close: ']',
	},
	link: {
		type: 'a',
		title: true,
		attributes: {
			href: '$content',
			target: 'blank',
			title: '$title',
		},
		textContent: '$title',
		open: '{{',
		close: '}}',
	},
	bold: {
		type: 'span',
		class: 'gn-bold',
		open: '**',
		close: '**',
	},
	italic: {
		type: 'span',
		class: 'gn-italic',
		open: '*',
		close: '*',
	},
	separator: {
		type: 'div',
		class: 'gn-separator',
		textContent: false,
		open: '\n---\n',
		close: '',
	},
	linejump: {
		type: 'br',
		textContent: false,
		open: '\n',
		close: '',
	},
	floatRight: {
		type: 'span',
		class: 'gn-float-right',
		open: '>*>',
		close: '<',
	},
};

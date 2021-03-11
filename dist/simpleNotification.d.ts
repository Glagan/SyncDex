declare module 'SimpleNotification' {
	export type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
	export type Type = 'success' | 'info' | 'error' | 'warning' | 'message';
	export type InsertAnimation =
		| 'default-insert'
		| 'insert-left'
		| 'insert-right'
		| 'insert-top'
		| 'insert-bottom'
		| 'fadein'
		| 'scalein'
		| 'rotatein';
	export type RemoveAnimation = 'fadeout' | 'scaleout' | 'rotateout';
	export type eventCallback = (notification: SimpleNotification) => void;
	export type Events = {
		onCreate?: eventCallback;
		onDisplay?: eventCallback;
		onDeath?: eventCallback;
		onClose?: (notification: SimpleNotification, fromUser: boolean) => void;
	};
	export type Button = {
		type?: Type;
		value?: string;
		onClick?: eventCallback;
	};

	export interface Content {
		image?: string;
		text?: string;
		title?: string;
		buttons?: Button[];
	}

	export interface TagDescription {
		type: string;
		class: string;
		open: string;
		close: string;
		attributes: { textContent: string | boolean } & { [key: string]: string };
		textContent: string;
	}

	export interface Options {
		position: Position;
		maxNotifications: number;
		removeAllOnDisplay: boolean;
		pauseOnHover: boolean;
		closeOnClick: boolean;
		closeButton: boolean;
		duration: number;
		sticky: boolean;
		events: Partial<Events>;
		insertAnimation: {
			name: InsertAnimation;
			duration?: number;
		};
		removeAnimation: {
			name: RemoveAnimation;
			duration?: number;
		};
	}

	global {
		class SimpleNotification {
			constructor(options?: Partial<Options>);
			options: Options;
			events: Partial<Events>;
			node?: HTMLElement;
			title?: HTMLElement;
			closeButton?: HTMLElement;
			body?: HTMLElement;
			image?: HTMLElement;
			text?: HTMLElement;
			buttons?: HTMLElement;
			progressBar?: HTMLElement;
			addExtinguish: () => void;
			removeExtinguish: () => void;
			// SimpleNotification
			make(classes: string[]): void;
			setTitle(type: string): void;
			setType(title: Type): void;
			setImage(src: string): void;
			setText(content: string): void;
			addCloseButton(): void;
			addBody(): void;
			addButton(type: Type, value: string, onClick: eventCallback): void;
			removeButtons(): void;
			addProgressBar(): void;
			display(): void;
			remove(): void;
			close(fromUser?: boolean): void;
			closeAnimated(): void;
			addExtinguishFct(): void;
			removeExtinguishFct(): void;
			disableButtons(): void;
			static wrappers: Partial<Record<Position, HTMLElement>>;
			static displayed: SimpleNotification[];
			static _options: Options;
			static makeWrapper(position: number): void;
			static create(classes: string[], content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static success(content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static info(content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static error(content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static warning(content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static message(content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static custom(classes: string[], content: Partial<Content>, options?: Partial<Options>): SimpleNotification;
			static addTag(name: string, tag: TagDescription): void;
			static deepAssign(target: Object, ...objs: any[]): Object;
			static options(options: Partial<Options>): void;
			// SimpleMark
			static refreshTokens?: boolean;
			static tags: Record<string, TagDescription>;
			static textToNode(text: string, node: HTMLElement): HTMLElement;
			static buildNode(string: string, node: HTMLElement): HTMLElement;
			static firstUnbreakChar(text: string, char: string, start?: number): number;
			static searchToken(string: string, token: string, start: number): [number, number];
			static breakString(string: string, tag: TagDescription, start: number, end: number): [number, number];
			static joinString(arr: string[]): string;
		}
	}
}

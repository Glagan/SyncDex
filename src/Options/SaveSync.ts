export abstract class SaveSync {
	abstract async card(node: HTMLButtonElement): Promise<void>;
	abstract manage(parent: HTMLElement): void;
	abstract async login(query: { [key: string]: string }): Promise<boolean>;
}

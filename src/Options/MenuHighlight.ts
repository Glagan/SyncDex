class Menu {
	link: HTMLElement;
	header: HTMLElement;
	marginTop: number = 0;

	constructor(link: HTMLElement) {
		this.link = link;
		const name = link.dataset.link as string;
		this.header = document.getElementById(name)!;
		this.marginTop = parseInt(getComputedStyle(this.header).marginTop);
	}

	isVisible(scroll: number): boolean {
		return scroll + window.innerHeight / 3 >= this.header.offsetTop - this.marginTop;
	}
}

export class MenuHighlight {
	node: HTMLElement;
	menus: Menu[] = [];
	activeMenu: number = 0;

	constructor() {
		this.node = document.getElementById('content')!;
		document.querySelectorAll<HTMLElement>('[data-link]').forEach((link) => {
			const menu = new Menu(link);
			link.addEventListener('click', () => {
				const scrollNode = window.innerWidth < 768 ? document.body : this.node;
				scrollNode.scroll({
					top: menu.header.offsetTop - menu.marginTop,
					behavior: 'smooth',
				});
			});
			this.menus.push(menu);
		});
		this.node.addEventListener(
			'scroll',
			() => window.requestAnimationFrame(() => this.frame(this.node.scrollTop)),
			{ passive: true }
		);
		this.frame(this.node.scrollTop);
	}

	frame(scrollTop: number) {
		if (scrollTop <= this.menus[0].marginTop) {
			this.activateMenu(0);
		} else if (scrollTop == this.node.scrollHeight - window.innerHeight) {
			const menuLength = this.menus.length - 1;
			this.activateMenu(menuLength);
		} else {
			for (let index = this.menus.length - 1; index >= 0; index--) {
				const menu = this.menus[index];
				if (menu.isVisible(scrollTop)) {
					if (this.activeMenu != index) {
						this.activateMenu(index);
					}
					break;
				}
			}
		}
	}

	activateMenu(index: number) {
		this.menus[this.activeMenu].link.classList.remove('active');
		this.activeMenu = index;
		this.menus[this.activeMenu].link.classList.add('active');
	}
}

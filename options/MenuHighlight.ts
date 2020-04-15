class Menu {
	link: HTMLElement;
	header: HTMLElement;
	marginTop: number = 0;

	constructor(link: HTMLElement) {
		this.link = link;
		const name = link.dataset.link as string;
		this.header = document.getElementById(name) as HTMLElement;
		this.marginTop = parseInt(getComputedStyle(this.header).marginTop);
	}

	isVisible = (scroll: number): boolean => {
		return scroll + window.innerHeight / 3 >= this.header.offsetTop - this.marginTop;
	};
}

export class MenuHighlight {
	node: HTMLElement;
	menus: Menu[] = [];
	activeMenu: number = 0;

	constructor(node: HTMLElement) {
		this.node = node;
		document.querySelectorAll<HTMLElement>('[data-link]').forEach((link) => {
			const menu = new Menu(link);
			link.addEventListener('click', () => {
				node.scroll({
					top: menu.header.offsetTop - menu.marginTop,
					behavior: 'smooth',
				});
			});
			this.menus.push(menu);
		});
		node.addEventListener(
			'scroll',
			() => window.requestAnimationFrame(() => this.frame(node.scrollTop)),
			{ passive: true }
		);
		this.frame(node.scrollTop);
	}

	frame = (scrollTop: number): void => {
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
	};

	activateMenu = (index: number): void => {
		this.menus[this.activeMenu].link.classList.remove('active');
		this.menus[this.activeMenu].header.classList.remove('active');
		this.menus[this.activeMenu].header.nextElementSibling?.classList.remove('active');
		this.activeMenu = index;
		this.menus[this.activeMenu].link.classList.add('active');
		this.menus[this.activeMenu].header.classList.add('active');
		this.menus[this.activeMenu].header.nextElementSibling?.classList.add('active');
	};
}

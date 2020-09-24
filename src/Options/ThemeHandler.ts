export class ThemeHandler {
	static binded: boolean = false;
	static bind(): void {
		if (!this.binded) {
			const prefersColorScheme = window.matchMedia('(prefers-color-scheme: dark)');
			const themeRow = document.getElementById('switch-theme')!;
			let themeButton: HTMLElement | undefined = undefined;

			// Function to switch light/dark themes
			const toggleTheme = (): void => {
				if (themeRow && themeButton) {
					themeButton.classList.toggle('fa-sun');
					themeButton.classList.toggle('fa-moon');
				}
				document.body.classList.toggle('dark');
				document.body.classList.toggle('light');
			};

			// Bind the Theme Button if there is one
			if (themeRow) {
				themeButton = themeRow.querySelector('i')!;
				themeRow.addEventListener('click', toggleTheme);
			}

			if (prefersColorScheme.matches) {
				document.body.classList.add('dark');
				if (themeButton) themeButton.className = 'fas fa-sun';
			}
			prefersColorScheme.addEventListener('change', toggleTheme);
			this.binded = true;
		}
	}
}

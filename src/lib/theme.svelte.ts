// Light / dark theme. app.html sets data-theme before first paint; this keeps it in sync and saves the choice.
export type Theme = 'light' | 'dark';

const KEY = 'foresight-theme';

function initial(): Theme {
	if (typeof document === 'undefined') return 'dark';
	return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export const theme = $state({ current: initial() });

export function setTheme(t: Theme) {
	theme.current = t;
	document.documentElement.dataset.theme = t;
	try {
		localStorage.setItem(KEY, t);
	} catch {
		// private mode or blocked storage: the theme still applies for this visit
	}
}

export function toggleTheme() {
	setTheme(theme.current === 'light' ? 'dark' : 'light');
}

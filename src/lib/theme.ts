/** Colour theme (ADR-044). Dark is the default; the choice lives in this browser only. */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'pe-theme';

/**
 * Runs in <head> before the first paint, so a light-theme user never sees a dark flash.
 * Storage can throw inside the Bitrix24 iframe; then the page simply stays dark.
 */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem('${THEME_KEY}')==='light')document.documentElement.dataset.theme='light'}catch(e){}`;

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme: Theme): void {
  if (theme === 'light') document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage blocked: the theme still applies for this page view.
  }
}

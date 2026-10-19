'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, currentTheme, type Theme } from '@/lib/theme';

// The <html data-theme> attribute is the source of truth; watch it rather than mirror it.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** Sidebar switch between the dark and the light theme (ADR-044). */
export function ThemeToggle() {
  const theme = React.useSyncExternalStore(subscribe, currentTheme, (): Theme => 'dark');

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
      }}
      className="text-fg-tertiary hover:text-fg flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] hover:bg-white/5"
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    </button>
  );
}

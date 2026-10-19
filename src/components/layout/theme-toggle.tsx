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

/** Sidebar icon switch between the dark and the light theme (ADR-044, ADR-064). */
export function ThemeToggle() {
  const theme = React.useSyncExternalStore(subscribe, currentTheme, (): Theme => 'dark');

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
      }}
      aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      className="text-fg-secondary hover:text-fg flex size-8 items-center justify-center rounded-[10px] border border-white/[0.08] bg-white/[0.05] hover:bg-white/10"
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

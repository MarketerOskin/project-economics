'use client';

import * as React from 'react';

/**
 * The part of the page the user can actually see (ADR-053).
 *
 * Inside Bitrix24 the app runs in an iframe that `BX24.fitWindow()` stretches to the full
 * content height, and the portal page scrolls instead of the app. `position: fixed` then
 * means "fixed to the whole tall iframe": a dialog centred with `top: 50%` opens far below
 * what is on screen, and only its dimmed overlay is visible. An IntersectionObserver with the
 * implicit root reports the slice of the iframe inside the top-level viewport, even across
 * origins, so overlays can be placed in that slice. Outside an iframe this is `null` and the
 * usual viewport positioning applies.
 */
export interface Band {
  top: number;
  height: number;
}

let band: Band | null = null;
const listeners = new Set<() => void>();
let observer: IntersectionObserver | null = null;

const THRESHOLDS = Array.from({ length: 201 }, (_, i) => i / 200);

function embedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function start() {
  if (observer || typeof IntersectionObserver === 'undefined' || !embedded()) return;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return;
      const r = entry.intersectionRect;
      const next =
        entry.isIntersecting && r.height > 0
          ? { top: Math.round(r.top), height: Math.round(r.height) }
          : null;
      if (next?.top === band?.top && next?.height === band?.height) return;
      band = next;
      for (const l of listeners) l();
    },
    { threshold: THRESHOLDS },
  );
  observer.observe(document.documentElement);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => {
    listeners.delete(cb);
  };
}

export function useViewportBand(): Band | null {
  return React.useSyncExternalStore(
    subscribe,
    () => band,
    () => null,
  );
}

/** Style that centres a fixed element in the visible slice, or nothing outside an iframe. */
export function centeredIn(b: Band | null): React.CSSProperties | undefined {
  if (!b) return undefined;
  return { top: b.top + b.height / 2, maxHeight: Math.max(240, b.height - 32) };
}

/** Style that pins a fixed element to the bottom of the visible slice. */
export function bottomOf(b: Band | null, gap = 16): React.CSSProperties | undefined {
  if (!b) return undefined;
  return { top: b.top + b.height - gap, bottom: 'auto', transform: 'translateY(-100%)' };
}

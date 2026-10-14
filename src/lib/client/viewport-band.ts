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
let started = false;

/**
 * Observing the whole document is not enough: in a tall iframe the visible share of the page
 * stays the same while the portal scrolls through its middle, so the observer never fires.
 * Instead a column of thin sentinels covers the iframe, each STEP px tall, and the band is the
 * span of the sentinels that are on screen. A fixed column covers exactly the iframe's own
 * viewport (the whole stretched page) without adding to the page height.
 */
const STEP = 40;
const THRESHOLDS = [0, 0.25, 0.5, 0.75, 1];

function embedded(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function start() {
  if (started || typeof IntersectionObserver === 'undefined' || !embedded()) return;
  started = true;

  const column = document.createElement('div');
  column.setAttribute('aria-hidden', 'true');
  column.style.cssText =
    'position:fixed;top:0;bottom:0;left:0;width:1px;pointer-events:none;opacity:0;z-index:-1;overflow:hidden';
  document.body.appendChild(column);

  const visible = new Map<Element, { top: number; bottom: number }>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const r = e.intersectionRect;
        if (e.isIntersecting && r.height > 0)
          visible.set(e.target, { top: r.top, bottom: r.bottom });
        else visible.delete(e.target);
      }
      let top = Infinity;
      let bottom = -Infinity;
      for (const v of visible.values()) {
        top = Math.min(top, v.top);
        bottom = Math.max(bottom, v.bottom);
      }
      const next = bottom > top ? { top: Math.round(top), height: Math.round(bottom - top) } : null;
      if (next?.top === band?.top && next?.height === band?.height) return;
      band = next;
      for (const l of listeners) l();
    },
    { threshold: THRESHOLDS },
  );

  const layout = () => {
    const want = Math.ceil(window.innerHeight / STEP);
    while (column.childElementCount < want) {
      const s = document.createElement('div');
      s.style.cssText = `position:absolute;left:0;width:1px;height:${STEP}px;top:${column.childElementCount * STEP}px`;
      column.appendChild(s);
      observer.observe(s);
    }
    while (column.childElementCount > want) {
      const last = column.lastElementChild!;
      observer.unobserve(last);
      visible.delete(last);
      last.remove();
    }
  };
  layout();
  window.addEventListener('resize', layout);
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

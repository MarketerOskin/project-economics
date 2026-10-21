'use client';

import * as React from 'react';

/** Pointer handler that feeds the `.spotlight` glow its position (ADR-065). */
export function useSpotlight<T extends HTMLElement>() {
  return React.useCallback((e: React.PointerEvent<T>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);
}

'use client';

import * as React from 'react';
import { MotionConfig } from 'motion/react';

/** One switch for every animation: honours the OS «reduce motion» setting (ADR-065). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  // iOS Safari applies `:active` (the press feedback, ADR-067) only once the page listens to
  // touches at all.
  React.useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

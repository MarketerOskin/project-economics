'use client';

import { MotionConfig } from 'motion/react';

/** One switch for every animation: honours the OS «reduce motion» setting (ADR-065). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

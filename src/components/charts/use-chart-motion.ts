'use client';

import { useReducedMotion } from 'motion/react';

/** Recharts animation props: drawn in on mount, off when the OS asks for reduced motion. */
export function useChartMotion(delay = 0) {
  const reduce = useReducedMotion();
  return {
    isAnimationActive: !reduce,
    animationBegin: delay,
    animationDuration: 1100,
    animationEasing: 'ease-out' as const,
  };
}

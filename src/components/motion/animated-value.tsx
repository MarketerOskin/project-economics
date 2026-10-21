'use client';

import * as React from 'react';
import { animate, useInView, useReducedMotion } from 'motion/react';

/**
 * Counts a figure up from zero when it scrolls into view (a «number ticker»). The float is only
 * for the frames in between: the last frame always prints `format(value)` from the exact
 * string, so the settled figure is the Decimal one, to the kopeck.
 */
export function AnimatedValue({
  value,
  format,
  duration = 1.1,
  className,
}: {
  value: string;
  format: (v: string) => string;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();
  const target = Number(value);
  const animatable = Number.isFinite(target) && target !== 0;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!inView || reduce || !animatable) {
      el.textContent = format(value);
      return;
    }
    // Round the in-between frames to whole units so the digits roll, not jitter.
    const controls = animate(0, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(String(Math.round(v)));
      },
      onComplete: () => {
        el.textContent = format(value);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, animatable, target, value, format, duration]);

  // Server and first paint show the exact figure, so no-JS, print and screen readers get it.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}

/**
 * The same for a ready-made label such as «48» or «3 ч 6 мин»: only a whole number animates;
 * anything else is shown as is.
 */
export function AnimatedLabel({ text, className }: { text: string; className?: string }) {
  const digits = /^\d[\d\s ]*$/.test(text) ? text.replace(/[\s ]/g, '') : null;
  const format = React.useCallback((v: string) => Number(v).toLocaleString('ru-RU'), []);
  if (digits === null) return <span className={className}>{text}</span>;
  return <AnimatedValue value={digits} format={format} duration={0.9} className={className} />;
}

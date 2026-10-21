'use client';

import * as React from 'react';
import { motion } from 'motion/react';

/** A small trend line under a KPI: drawn left to right, with a soft gradient below. */
export function Sparkline({
  values,
  color = 'var(--accent)',
  className,
}: {
  values: (number | null)[];
  color?: string;
  className?: string;
}) {
  const id = React.useId().replace(/:/g, '');
  const pts = values.map((v) => v ?? 0);
  if (pts.length < 2) return null;
  const w = 300;
  const h = 36;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map((v, i) => [(i / (pts.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)]);
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)},${y!.toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#sp${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      />
    </svg>
  );
}

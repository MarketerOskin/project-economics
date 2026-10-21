'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AnimatedLabel } from '@/components/motion/animated-value';
import { useSpotlight } from '@/components/motion/spotlight';

/**
 * One analytics figure: counts and durations, not money (KpiCard is plan/fact money). With
 * `href` the card opens what the number is made of (ADR-049).
 */
export function Stat({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'negative';
  href?: string;
}) {
  const onPointerMove = useSpotlight<HTMLElement>();
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="tx-mark text-fg-tertiary">{label}</div>
        {href ? (
          <ChevronRight className="text-fg-tertiary group-hover:text-accent size-4 shrink-0 transition-colors" />
        ) : null}
      </div>
      <div
        className={cn(
          'font-display nums mt-2.5 text-[26px] leading-none font-bold tracking-tight',
          tone === 'negative' && 'text-negative',
        )}
      >
        <AnimatedLabel text={value} />
      </div>
      {hint ? <div className="text-fg-tertiary mt-2 font-mono text-[11px]">{hint}</div> : null}
    </>
  );
  const cls =
    'spotlight border border-border bg-surface p-4 transition-[border-color,translate] duration-300 hover:-translate-y-0.5';
  if (href) {
    return (
      <Link href={href} onPointerMove={onPointerMove} className={cn(cls, 'group block')}>
        {body}
      </Link>
    );
  }
  return (
    <div onPointerMove={onPointerMove} className={cls}>
      {body}
    </div>
  );
}

const XL_COLS = { 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5', 6: 'xl:grid-cols-6' } as const;

/** Columns follow the card count, so the last row is as full as it can be (no lone card). */
export function StatGrid({ children }: { children: React.ReactNode }) {
  const n = React.Children.toArray(children).length;
  const gap = (c: number) => (c - (n % c)) % c;
  const cols = ([6, 5, 4] as const).reduce((best, c) => (gap(c) < gap(best) ? c : best));
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3', XL_COLS[cols])}>
      {children}
    </div>
  );
}

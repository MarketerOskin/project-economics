'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRubStr, formatPercentStr, formatPointsStr } from '@/lib/format';
import { AnimatedValue } from '@/components/motion/animated-value';
import { Sparkline } from '@/components/motion/sparkline';
import { useSpotlight } from '@/components/motion/spotlight';

interface KpiProps {
  label: string;
  factValue: string;
  planValue: string;
  /** Deviation (fact − plan) as a string, or null. */
  deviation?: string | null;
  /** Render values as percent instead of money (for the margin card). */
  percent?: boolean;
  /** For the margin card: fact − plan in percentage points. */
  points?: string | null;
  /** The operations this figure is summed from (ADR-049). */
  href?: string;
  /** Per-bucket trend for the sparkline (ADR-065). */
  spark?: (number | null)[];
  /**
   * Against the previous period of the same length: percent for money, points for the margin
   * card. `undefined` hides the badge, `null` says there is nothing to compare with.
   */
  change?: string | null;
  /** Lower is better (expenses): a rise is painted red. */
  invert?: boolean;
}

const money = (v: string) => formatRubStr(v);
const pct = (v: string) => formatPercentStr(v);

export function KpiCard({
  label,
  factValue,
  planValue,
  deviation,
  percent,
  points,
  href,
  spark,
  change,
  invert,
}: KpiProps) {
  const factNum = factValue === null ? null : Number(factValue);
  const negative = factNum !== null && factNum < 0;
  const format = percent ? pct : money;
  return (
    <Box href={href}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            aria-hidden
            className="bg-accent mb-3 h-[3px] w-9 rounded-full shadow-[0_0_12px_var(--accent)]"
          />
          <div className="tx-mark text-fg-tertiary text-sm">{label}</div>
        </div>
        {change !== undefined ? (
          <ChangeBadge change={change} percent={percent} invert={invert} />
        ) : null}
      </div>
      <div
        className={cn(
          'font-display nums mt-3 text-[32px] leading-none font-semibold tracking-tight',
          negative && 'text-negative',
        )}
      >
        <AnimatedValue value={factValue} format={format} />
      </div>
      {spark && spark.length > 1 ? (
        <Sparkline
          values={spark}
          color={negative ? 'var(--negative)' : invert ? 'var(--fg-tertiary)' : 'var(--accent)'}
          className="mt-3 h-9 w-full"
        />
      ) : null}
      <div className="text-fg-tertiary mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>План: {format(planValue)}</span>
        {points !== undefined ? (
          <DeviationBadge text={formatPointsStr(points)} value={points ? Number(points) : null} />
        ) : deviation !== undefined ? (
          <DeviationBadge
            text={
              deviation === null
                ? '—'
                : `${Number(deviation) > 0 ? '+' : ''}${formatRubStr(deviation)}`
            }
            value={deviation === null ? null : Number(deviation)}
          />
        ) : null}
      </div>
    </Box>
  );
}

function Box({ href, children }: { href?: string; children: React.ReactNode }) {
  const onPointerMove = useSpotlight<HTMLElement>();
  const cls =
    'spotlight group border border-border bg-surface rounded-[22px] px-[22px] pt-[18px] pb-[22px] transition-[border-color,translate] duration-300 hover:-translate-y-0.5';
  return href ? (
    <Link href={href} onPointerMove={onPointerMove} className={cn(cls, 'block')}>
      {children}
    </Link>
  ) : (
    <div onPointerMove={onPointerMove} className={cls}>
      {children}
    </div>
  );
}

/** «↗ 12,4 %» against the previous period; for the margin card the change is in п.п. */
function ChangeBadge({
  change,
  percent,
  invert,
}: {
  change: string | null;
  percent?: boolean;
  invert?: boolean;
}) {
  if (change === null) {
    return (
      <span
        className="text-fg-tertiary shrink-0 rounded-full border border-[var(--glass-border)] px-2 py-0.5 text-[11px]"
        title="В прошлом периоде той же длины данных нет"
      >
        нет базы
      </span>
    );
  }
  const n = Number(change);
  const up = n > 0;
  const good = n === 0 ? null : invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title="К прошлому периоду той же длины"
      className={cn(
        'nums inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        good === null
          ? 'text-fg-tertiary bg-white/5'
          : good
            ? 'text-positive bg-positive-soft'
            : 'text-negative bg-negative-soft',
      )}
    >
      {n !== 0 ? <Icon className="size-3" /> : null}
      {/* The arrow carries the sign. */}
      {(percent ? formatPointsStr(change) : formatPercentStr(change)).replace(/^[+−-]/, '')}
    </span>
  );
}

function DeviationBadge({ text, value }: { text: string; value: number | null }) {
  const tone =
    value === null || value === 0
      ? 'text-fg-tertiary'
      : value > 0
        ? 'text-positive'
        : 'text-negative';
  return <span className={cn('font-medium', tone)}>{text}</span>;
}

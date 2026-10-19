import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatRubStr, formatPercentStr, formatPointsStr } from '@/lib/format';

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
}

export function KpiCard({
  label,
  factValue,
  planValue,
  deviation,
  percent,
  points,
  href,
}: KpiProps) {
  const factNum = factValue === null ? null : Number(factValue);
  const negative = factNum !== null && factNum < 0;
  return (
    <Box href={href}>
      <div aria-hidden className="bg-accent mb-3 h-[3px] w-9 rounded-full" />
      <div className="tx-mark text-fg-tertiary text-sm">{label}</div>
      <div
        className={cn(
          'font-display nums mt-3 text-[32px] leading-none font-semibold tracking-tight',
          negative && 'text-negative',
        )}
      >
        {percent ? formatPercentStr(factValue) : formatRubStr(factValue)}
      </div>
      <div className="text-fg-tertiary mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>План: {percent ? formatPercentStr(planValue) : formatRubStr(planValue)}</span>
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
  const cls =
    'border border-border bg-surface rounded-[22px] px-[22px] pt-[18px] pb-[22px] transition-colors hover:border-border-strong';
  return href ? (
    <Link href={href} className={cn(cls, 'block')}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
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

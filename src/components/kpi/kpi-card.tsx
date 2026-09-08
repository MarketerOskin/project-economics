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
}

export function KpiCard({ label, factValue, planValue, deviation, percent, points }: KpiProps) {
  const factNum = factValue === null ? null : Number(factValue);
  const negative = factNum !== null && factNum < 0;

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-fg-tertiary">{label}</div>
      <div
        className={cn(
          'mt-2 text-[26px] font-semibold leading-none tracking-tight nums',
          negative && 'text-negative',
        )}
      >
        {percent ? formatPercentStr(factValue) : formatRubStr(factValue)}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-fg-tertiary">
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
    </div>
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

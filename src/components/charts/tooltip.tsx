'use client';

import { formatRub } from '@/lib/format';
import { m } from '@/domain/finance/money';

interface Item {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

/** Compact ink-token tooltip used by every dashboard chart. */
export function ChartTooltip({
  active,
  label,
  payload,
  labelFormatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Item[];
  labelFormatter?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label !== undefined ? (
        <div className="mb-1 font-medium text-fg">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      ) : null}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-fg-secondary">
          <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="nums font-medium text-fg">
            {p.value !== undefined ? formatRub(m(String(p.value))) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

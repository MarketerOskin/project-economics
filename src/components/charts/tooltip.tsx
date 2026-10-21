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
    <div className="glass-popover min-w-[180px] rounded-xl px-3 py-2.5 text-xs">
      {label !== undefined ? (
        <div className="text-fg mb-1.5 font-semibold">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      ) : null}
      {payload.map((p, i) => (
        <div key={i} className="text-fg-secondary flex items-center gap-2 py-0.5">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: p.color, boxShadow: `0 0 8px ${p.color}` }}
          />
          <span className="flex-1">{p.name}</span>
          <span className="nums text-fg font-medium">
            {p.value !== undefined ? formatRub(m(String(p.value))) : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

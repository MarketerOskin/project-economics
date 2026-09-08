'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { m } from '@/domain/finance/money';
import { formatRub, formatPercent } from '@/lib/format';
import { CHART } from './chart-theme';

interface Slice {
  categoryId: string;
  name: string;
  color: string;
  amount: string;
}

const MAX_SLICES = 6;

export function ExpenseStructureChart({ data }: { data: Slice[] }) {
  const total = data.reduce((n, s) => n.plus(m(s.amount)), m(0));

  // Top N + "Другое" (ТЗ §20) — keeps the ring legible and CVD-safe.
  const top = data.slice(0, MAX_SLICES);
  const rest = data.slice(MAX_SLICES);
  const slices = [
    ...top,
    ...(rest.length
      ? [
          {
            categoryId: '_other',
            name: 'Другое',
            color: CHART.inkTertiary,
            amount: rest.reduce((n, s) => n.plus(m(s.amount)), m(0)).toString(),
          },
        ]
      : []),
  ];

  if (slices.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-tertiary">Нет расходов за период</p>;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="shrink-0" style={{ width: 168, height: 168 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices.map((s) => ({ ...s, value: Number(s.amount) }))}
              dataKey="value"
              nameKey="name"
              innerRadius={52}
              outerRadius={80}
              paddingAngle={2}
              stroke={CHART.surface}
              strokeWidth={2}
            >
              {slices.map((s) => (
                <Cell key={s.categoryId} fill={s.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with values + share — identity is never colour-alone (ТЗ §20). */}
      <ul className="flex-1 space-y-1.5">
        {slices.map((s) => {
          const share = total.isZero() ? null : m(s.amount).div(total).times(100);
          return (
            <li key={s.categoryId} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 text-fg-secondary">{s.name}</span>
              <span className="nums text-fg">{formatRub(m(s.amount))}</span>
              <span className="w-12 text-right text-xs text-fg-tertiary">{formatPercent(share)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import * as React from 'react';
import { motion } from 'motion/react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { m } from '@/domain/finance/money';
import { formatRub, formatPercent } from '@/lib/format';
import { CHART } from './chart-theme';
import { useChartMotion } from './use-chart-motion';

interface Slice {
  categoryId: string;
  name: string;
  color: string;
  amount: string;
}

const MAX_SLICES = 6;

export function ExpenseStructureChart({ data }: { data: Slice[] }) {
  const anim = useChartMotion();
  const [active, setActive] = React.useState<number | undefined>(undefined);
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
    return <p className="text-fg-tertiary py-8 text-center text-sm">Нет расходов за период</p>;
  }

  const shown = active === undefined ? undefined : slices[active];
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative mx-auto shrink-0 sm:mx-0" style={{ width: 184, height: 184 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              {...anim}
              data={slices.map((s) => ({ ...s, value: Number(s.amount) }))}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={84}
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(undefined)}
            >
              {slices.map((s, i) => (
                <Cell
                  key={s.categoryId}
                  fill={s.color}
                  fillOpacity={active === undefined || active === i ? 1 : 0.3}
                  style={{
                    transition: 'fill-opacity 0.2s, filter 0.2s',
                    filter: active === i ? `drop-shadow(0 0 8px ${s.color})` : undefined,
                    outline: 'none',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* The total, or the hovered slice, in the hole. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <motion.div
            key={shown?.categoryId ?? 'total'}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="px-6"
          >
            <div className="text-fg-tertiary max-w-[104px] truncate text-[11px]">
              {shown ? shown.name : 'Всего'}
            </div>
            <div className="font-display nums text-fg mt-0.5 text-[15px] font-bold">
              {formatRub(shown ? m(shown.amount) : total)}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Legend with values + share — identity is never colour-alone (ТЗ §20). */}
      <ul className="min-w-0 flex-1 space-y-2.5">
        {slices.map((s, i) => {
          const share = total.isZero() ? null : m(s.amount).div(total).times(100);
          return (
            <li
              key={s.categoryId}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(undefined)}
              className={`text-sm transition-opacity ${active !== undefined && active !== i ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }}
                />
                <span className="text-fg-secondary min-w-0 flex-1 truncate">{s.name}</span>
                <span className="nums text-fg">{formatRub(m(s.amount))}</span>
                <span className="text-fg-tertiary w-12 text-right text-xs">
                  {formatPercent(share)}
                </span>
              </div>
              <div className="mt-1 ml-[18px] h-1 overflow-hidden rounded-full bg-white/[0.06] in-data-[theme=light]:bg-black/[0.05]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: s.color }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${share ? share.toNumber() : 0}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, delay: 0.3 + 0.05 * i, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

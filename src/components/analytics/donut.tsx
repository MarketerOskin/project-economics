'use client';

import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { CHART } from '@/components/charts/chart-theme';

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  /** Already formatted for the legend, e.g. "12,5 ч". */
  display: string;
  color: string;
  /** Where the slice's list opens (ADR-049). */
  href?: string;
}

/** Ring with the total in the middle and a legend that always names each slice (ADR-047). */
export function Donut({
  items,
  center,
  empty,
}: {
  items: DonutItem[];
  center: string;
  empty: string;
}) {
  const shown = items.filter((i) => i.value > 0);
  if (shown.length === 0)
    return <p className="text-fg-tertiary py-8 text-center text-sm">{empty}</p>;
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: 160, height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={shown.length > 1 ? 2 : 0}
              stroke={CHART.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {shown.map((i) => (
                <Cell key={i.key} fill={i.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="font-display nums pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] font-bold">
          {center}
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-2">
        {shown.map((i) => (
          <li key={i.key} className="text-sm">
            {i.href ? (
              <Link href={i.href} className="group flex items-center gap-2">
                <span className="size-2.5 shrink-0" style={{ backgroundColor: i.color }} />
                <span className="text-fg-secondary group-hover:text-accent min-w-0 flex-1 truncate group-hover:underline">
                  {i.label}
                </span>
                <span className="nums text-fg-tertiary">{i.display}</span>
              </Link>
            ) : (
              <span className="flex items-center gap-2">
                <span className="size-2.5 shrink-0" style={{ backgroundColor: i.color }} />
                <span className="text-fg-secondary min-w-0 flex-1 truncate">{i.label}</span>
                <span className="nums text-fg-tertiary">{i.display}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

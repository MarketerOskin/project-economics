'use client';

import { useRouter } from 'next/navigation';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, axisProps } from './chart-theme';
import { ChartTooltip } from './tooltip';
import { formatRubStr } from '@/lib/format';
import { cn } from '@/lib/cn';

interface ProfitBar {
  id: string;
  name: string;
  profit: string;
  margin: string | null;
}

const compact = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`
    : `${Math.round(v / 1000).toLocaleString('ru-RU')} тыс`;

function TruncatedTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const text = payload?.value ?? '';
  const clipped = text.length > 22 ? `${text.slice(0, 21)}…` : text;
  return (
    <text x={x} y={y} dy={4} textAnchor="end" fill={CHART.inkSecondary} fontSize={CHART.fontSize}>
      {clipped}
    </text>
  );
}

export function ProjectProfitChart({ data }: { data: ProfitBar[] }) {
  const router = useRouter();
  const rows = data.slice(0, 10).map((b) => ({ ...b, value: Number(b.profit) }));

  const rawMax = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  // Round the axis bound up to a clean step so ticks read nicely.
  const step = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxAbs = Math.ceil(rawMax / step) * step;

  return (
    <div className="flex flex-col gap-3">
      <ResponsiveContainer width="100%" height={Math.max(170, rows.length * 36)}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
          barCategoryGap={10}
        >
          <XAxis
            type="number"
            domain={[-maxAbs, maxAbs]}
            tickFormatter={compact}
            {...axisProps}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            interval={0}
            {...axisProps}
            tick={<TruncatedTick />}
          />
          <Tooltip cursor={{ fill: CHART.grid }} content={<ChartTooltip />} />
          <Bar
            dataKey="value"
            name="Прибыль"
            barSize={16}
            radius={2}
            isAnimationActive={false}
            onClick={(d: { id?: string }) => d.id && router.push(`/projects/${d.id}`)}
            cursor="pointer"
          >
            {rows.map((r) => (
              <Cell key={r.id} fill={r.value < 0 ? CHART.negative : CHART.positive} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: r.value < 0 ? CHART.negative : CHART.positive }}
              />
              <span className="truncate text-fg-secondary">{r.name}</span>
            </span>
            <span className={cn('nums shrink-0', r.value < 0 ? 'text-negative' : 'text-fg')}>
              {formatRubStr(r.profit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

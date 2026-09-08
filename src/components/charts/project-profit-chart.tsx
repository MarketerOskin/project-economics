'use client';

import { useRouter } from 'next/navigation';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, axisProps } from './chart-theme';
import { ChartTooltip } from './tooltip';
import { formatRubStr } from '@/lib/format';

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

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, rows.length * 34)}>
      <BarChart
        layout="vertical"
        data={rows}
        margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        barCategoryGap={8}
      >
        <XAxis type="number" tickFormatter={compact} {...axisProps} />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          interval={0}
          {...axisProps}
          tick={<TruncatedTick />}
        />
        <Tooltip cursor={{ fill: CHART.grid }} content={<ChartTooltip />} />
        <Bar
          dataKey="value"
          name="Прибыль"
          radius={[0, 4, 4, 0]}
          onClick={(d: { id?: string }) => d.id && router.push(`/projects/${d.id}`)}
          cursor="pointer"
        >
          {rows.map((r) => (
            <Cell key={r.id} fill={r.value < 0 ? CHART.negative : CHART.positive} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: number) => formatRubStr(String(v))}
            style={{ fill: CHART.inkSecondary, fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

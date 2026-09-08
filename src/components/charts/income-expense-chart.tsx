'use client';

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART, axisProps } from './chart-theme';
import { ChartTooltip } from './tooltip';

interface Point {
  bucket: string;
  factIncome: string;
  factExpense: string;
  planIncome: string;
  planExpense: string;
}

const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' }).format(d);
};

const compact = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн`
    : `${Math.round(v / 1000).toLocaleString('ru-RU')} тыс`;

export function IncomeExpenseChart({ data, showPlan }: { data: Point[]; showPlan: boolean }) {
  const rows = data.map((p) => ({
    bucket: p.bucket,
    'Доход (факт)': Number(p.factIncome),
    'Расход (факт)': Number(p.factExpense),
    'Доход (план)': Number(p.planIncome),
    'Расход (план)': Number(p.planExpense),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id="incFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.income} stopOpacity={0.16} />
            <stop offset="100%" stopColor={CHART.income} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} vertical={false} />
        <XAxis dataKey="bucket" tickFormatter={monthLabel} {...axisProps} />
        <YAxis tickFormatter={compact} width={56} {...axisProps} />
        <Tooltip content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} />} />
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="Доход (факт)"
          stroke={CHART.income}
          strokeWidth={2}
          fill="url(#incFill)"
          dot={false}
        />
        <Line
            isAnimationActive={false}
          type="monotone"
          dataKey="Расход (факт)"
          stroke={CHART.expense}
          strokeWidth={2}
          dot={false}
        />
        {showPlan ? (
          <>
            <Line
            isAnimationActive={false}
              type="monotone"
              dataKey="Доход (план)"
              stroke={CHART.income}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
            isAnimationActive={false}
              type="monotone"
              dataKey="Расход (план)"
              stroke={CHART.expense}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </>
        ) : null}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

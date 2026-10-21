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
import { useChartMotion } from './use-chart-motion';

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

/**
 * Plan vs fact over time. `monotone` on purpose: it never overshoots the points, so a month
 * with no operations reads as a dip to zero, not as a phantom hump (ADR-065).
 */
export function IncomeExpenseChart({ data, showPlan }: { data: Point[]; showPlan: boolean }) {
  const anim = useChartMotion();
  const rows = data.map((p) => ({
    bucket: p.bucket,
    'Доход (факт)': Number(p.factIncome),
    'Расход (факт)': Number(p.factExpense),
    'Доход (план)': Number(p.planIncome),
    'Расход (план)': Number(p.planExpense),
  }));
  const dot = (color: string) => ({
    r: 4,
    fill: color,
    stroke: CHART.surface,
    strokeWidth: 2,
    style: { filter: `drop-shadow(0 0 6px ${color})` },
  });

  return (
    <div>
      <div className="text-fg-tertiary mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
        <LegendMark color={CHART.income} label="Доход" />
        <LegendMark color={CHART.expense} label="Расход" />
        {showPlan ? <LegendMark color={CHART.inkTertiary} label="План" dashed /> : null}
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <defs>
            <linearGradient id="incFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.income} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART.income} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="expFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.expense} stopOpacity={0.22} />
              <stop offset="100%" stopColor={CHART.expense} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} vertical={false} strokeDasharray="3 6" />
          <XAxis dataKey="bucket" tickFormatter={monthLabel} minTickGap={16} {...axisProps} />
          <YAxis tickFormatter={compact} width={56} {...axisProps} />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: '4 4' }}
            content={<ChartTooltip labelFormatter={(l) => monthLabel(String(l))} />}
          />
          <Area
            {...anim}
            type="monotone"
            dataKey="Доход (факт)"
            stroke={CHART.income}
            strokeWidth={2.5}
            fill="url(#incFill)"
            dot={false}
            activeDot={dot(CHART.income)}
          />
          <Area
            {...anim}
            animationBegin={150}
            type="monotone"
            dataKey="Расход (факт)"
            stroke={CHART.expense}
            strokeWidth={2}
            fill="url(#expFill)"
            dot={false}
            activeDot={dot(CHART.expense)}
          />
          {showPlan ? (
            <>
              <Line
                {...anim}
                animationBegin={400}
                type="monotone"
                dataKey="Доход (план)"
                stroke={CHART.income}
                strokeOpacity={0.7}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
              <Line
                {...anim}
                animationBegin={400}
                type="monotone"
                dataKey="Расход (план)"
                stroke={CHART.expense}
                strokeOpacity={0.7}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={false}
              />
            </>
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function LegendMark({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-0 w-4"
        style={{ borderTop: `2px ${dashed ? 'dashed' : 'solid'} ${color}` }}
      />
      {label}
    </span>
  );
}

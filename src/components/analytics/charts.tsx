'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, axisProps } from '@/components/charts/chart-theme';
import { formatDayKey, formatHours } from '@/lib/format';

/** Lime = task time (the brand series), blue = meetings, from the validated category palette. */
export const SERIES = { tasks: CHART.income, meetings: '#3987e5', created: CHART.expense, closed: CHART.income } as const;

export interface DayDatum {
  day: string;
  taskSeconds: number;
  meetingSeconds: number;
  created: number;
  closed: number;
}

function Legend({ items }: { items: Array<{ color: string; label: string }> }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 font-mono text-[11px] text-fg-tertiary">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

function DayTooltip({
  active,
  label,
  payload,
  unit,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  unit: 'hours' | 'count';
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="border border-border bg-surface px-3 py-2 text-xs">
      <div className="mb-1 font-medium text-fg">{formatDayKey(label)}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-fg-secondary">
          <span className="size-2" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="nums font-medium text-fg">
            {unit === 'hours' ? `${formatHours((p.value ?? 0) * 3600)} ч` : (p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

const tickDay = (d: string) => formatDayKey(d);

/** Hours per day, stacked: task time + meetings. */
export function HoursByDayChart({ data }: { data: DayDatum[] }) {
  const rows = data.map((d) => ({ day: d.day, tasks: d.taskSeconds / 3600, meetings: d.meetingSeconds / 3600 }));
  return (
    <div>
      <Legend items={[{ color: SERIES.tasks, label: 'Задачи' }, { color: SERIES.meetings, label: 'Встречи' }]} />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="day" tickFormatter={tickDay} minTickGap={16} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip cursor={{ fill: CHART.grid }} content={<DayTooltip unit="hours" />} />
          <Bar dataKey="tasks" name="Задачи" stackId="h" fill={SERIES.tasks} isAnimationActive={false} />
          <Bar dataKey="meetings" name="Встречи" stackId="h" fill={SERIES.meetings} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tasks created vs completed per day. */
export function TaskFlowChart({ data }: { data: DayDatum[] }) {
  return (
    <div>
      <Legend items={[{ color: SERIES.created, label: 'Создано' }, { color: SERIES.closed, label: 'Выполнено' }]} />
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barGap={1}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="day" tickFormatter={tickDay} minTickGap={16} {...axisProps} />
          <YAxis allowDecimals={false} {...axisProps} />
          <Tooltip cursor={{ fill: CHART.grid }} content={<DayTooltip unit="count" />} />
          <Bar dataKey="created" name="Создано" fill={SERIES.created} isAnimationActive={false} />
          <Bar dataKey="closed" name="Выполнено" fill={SERIES.closed} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

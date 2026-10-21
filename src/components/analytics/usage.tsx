import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatHours } from '@/lib/format';
import { plural } from '@/lib/text';

export interface UsageCardData {
  projectId: string;
  name: string;
  clientName: string | null;
  totalSeconds: number;
  taskSeconds: number;
  meetingSeconds: number;
  /** Package for the period (limit × months touched); null = no package set. */
  limitSeconds: number | null;
  overageSeconds: number;
  done: number;
  openNow: number;
  /** Tasks created in the period. */
  created: number;
  meetings: number;
  /** The last month of the period against its package, when one is set. */
  month: {
    label: string;
    taskSeconds: number;
    meetingSeconds: number;
    totalSeconds: number;
    limitSeconds: number | null;
  } | null;
}

/** "X из N ч" with a package bar; red once over. */
export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null || limit <= 0) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  return (
    <div className="bg-surface-muted h-1.5 w-full" aria-hidden>
      <div
        className={cn('h-full', over ? 'bg-negative' : 'bg-[var(--chart-primary)]')}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Stacked bar: task hours and meeting hours against the package (or the total without one). */
function SplitBar({
  task,
  meeting,
  limit,
}: {
  task: number;
  meeting: number;
  limit: number | null;
}) {
  const total = task + meeting;
  const base = limit && limit > 0 ? Math.max(limit, total) : total;
  if (base <= 0) return <div className="bg-surface-muted h-3 w-full rounded-full" aria-hidden />;
  const over = limit !== null && limit > 0 && total > limit;
  return (
    <div className="bg-surface-muted flex h-3 w-full overflow-hidden rounded-full" aria-hidden>
      <div
        className={cn('h-full', over ? 'bg-negative' : 'bg-[var(--chart-primary)]')}
        style={{ width: `${(task / base) * 100}%` }}
      />
      <div
        className={cn('h-full', over ? 'bg-negative/70' : 'bg-[var(--cat-blue)]')}
        style={{ width: `${(meeting / base) * 100}%` }}
      />
    </div>
  );
}

function Count({ n, label, muted }: { n: number; label: string; muted?: boolean }) {
  return (
    <span className={cn('whitespace-nowrap', muted && 'text-fg-tertiary')}>
      {muted ? null : <b className="text-fg mr-1.5 font-semibold">{n}</b>}
      {muted ? `${n} ${label}` : label}
    </span>
  );
}

/** «Часы по проектам» in the layout of the statistics app the team already uses (ADR-050). */
export function UsageCards({ items, query }: { items: UsageCardData[]; query: string }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <Link
          key={c.projectId}
          href={`/projects/${c.projectId}/analytics${query}`}
          className="border-border bg-surface hover:border-accent flex flex-col gap-4 rounded-2xl border p-6 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-fg truncate text-xl font-semibold">{c.name}</div>
              {c.clientName ? (
                <div className="text-fg-tertiary truncate text-sm">{c.clientName}</div>
              ) : null}
            </div>
            {c.overageSeconds > 0 ? (
              <span className="bg-negative text-bg shrink-0 rounded-full px-3 py-1 text-sm font-semibold">
                сверх пакета +{formatHours(c.overageSeconds)} ч
              </span>
            ) : c.limitSeconds !== null ? (
              <span className="bg-accent-soft text-accent shrink-0 rounded-full px-3 py-1 text-sm font-semibold">
                в пределах пакета
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display nums text-[56px] leading-none font-bold">
              {formatHours(c.totalSeconds)}
            </span>
            <span className="text-fg-tertiary text-lg">ч за период</span>
          </div>
          {c.month && c.month.limitSeconds !== null ? (
            <div className="text-fg text-[15px]">
              {c.month.label}: <b>{formatHours(c.month.totalSeconds)}</b> из{' '}
              {formatHours(c.month.limitSeconds)} ч
            </div>
          ) : null}
          {c.month && c.month.limitSeconds !== null ? (
            <SplitBar
              task={c.month.taskSeconds}
              meeting={c.month.meetingSeconds}
              limit={c.month.limitSeconds}
            />
          ) : (
            <SplitBar task={c.taskSeconds} meeting={c.meetingSeconds} limit={null} />
          )}
          <div className="text-fg-tertiary flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--chart-primary)]" aria-hidden />
              задачи {formatHours(c.taskSeconds)} ч
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="size-3 rounded-full bg-[var(--cat-blue)]" aria-hidden />
              встречи {formatHours(c.meetingSeconds)} ч
            </span>
          </div>
          <div className="border-border text-fg-secondary flex flex-wrap gap-x-6 gap-y-1 border-t pt-4 text-[15px]">
            <Count n={c.created} label="заявок" />
            <Count n={c.done} label="выполнено" />
            <Count
              n={c.meetings}
              label={plural(c.meetings, 'встреча', 'встречи', 'встреч')}
              muted
            />
            <Count n={c.openNow} label="в работе" />
          </div>
        </Link>
      ))}
    </div>
  );
}

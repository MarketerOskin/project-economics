import Link from 'next/link';
import { cn } from '@/lib/cn';
import { formatHours } from '@/lib/format';

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
}

/** "X из N ч" with a package bar; red once over. */
export function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null || limit <= 0) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  return (
    <div className="h-1.5 w-full bg-surface-muted" aria-hidden>
      <div className={cn('h-full', over ? 'bg-negative' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function UsageCards({ items, query }: { items: UsageCardData[]; query: string }) {
  if (items.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((c) => (
        <Link
          key={c.projectId}
          href={`/projects/${c.projectId}/analytics${query}`}
          className="flex flex-col gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-medium text-fg">{c.name}</div>
              {c.clientName ? <div className="truncate text-xs text-fg-tertiary">{c.clientName}</div> : null}
            </div>
            {c.overageSeconds > 0 ? (
              <span className="shrink-0 bg-negative px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-bg">
                +{formatHours(c.overageSeconds)} ч
              </span>
            ) : null}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-[24px] font-bold leading-none nums">{formatHours(c.totalSeconds)}</span>
            <span className="text-sm text-fg-tertiary">
              {c.limitSeconds !== null ? `из ${formatHours(c.limitSeconds)} ч` : 'ч'}
            </span>
          </div>
          <UsageBar used={c.totalSeconds} limit={c.limitSeconds} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-fg-tertiary">
            <span>задачи {formatHours(c.taskSeconds)} ч</span>
            <span>встречи {formatHours(c.meetingSeconds)} ч</span>
            <span>выполнено {c.done}</span>
            <span>открыто {c.openNow}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

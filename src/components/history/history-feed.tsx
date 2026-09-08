import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { HumanAuditEntry } from '@/lib/audit/humanize';

const DESTRUCTIVE = new Set(['FINANCE_DELETED', 'PROJECT_ARCHIVED', 'PROJECT_MEMBER_REMOVED']);

export function HistoryFeed({ entries }: { entries: HumanAuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-10 text-center text-sm text-fg-tertiary">Записей пока нет</p>;
  }

  return (
    <ol className="space-y-1">
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex gap-4 rounded-[12px] border border-border bg-surface px-4 py-3"
        >
          <div
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
              DESTRUCTIVE.has(e.action) ? 'bg-negative' : 'bg-border-strong',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-fg-tertiary">{formatDateTime(new Date(e.when))}</div>
            <div className="mt-0.5 text-sm">
              <span className="font-medium text-fg">{e.who}</span>{' '}
              <span className="text-fg-secondary">{e.sentence}</span>
            </div>
            {e.change ? (
              <div className="mt-1 text-sm text-fg nums">{e.change}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

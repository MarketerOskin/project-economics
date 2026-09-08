'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRubStr, formatPercentStr } from '@/lib/format';
import { StatusBadge } from './status-badge';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import type { ProjectListRow } from '@/server/services/project-read';

type SortKey = 'name' | 'income' | 'expense' | 'profit' | 'margin';

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'name', label: 'Проект' },
  { key: 'income', label: 'Доход', align: 'right' },
  { key: 'expense', label: 'Расход', align: 'right' },
  { key: 'profit', label: 'Прибыль', align: 'right' },
  { key: 'margin', label: 'Рентабельность', align: 'right' },
];

export function ProjectsTable({ rows }: { rows: ProjectListRow[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const sort = (params.get('sort') ?? 'profit') as SortKey;
  const dir = (params.get('dir') ?? 'desc') as 'asc' | 'desc';

  const setSort = (key: SortKey) => {
    const next = new URLSearchParams(params);
    if (sort === key) {
      next.set('dir', dir === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sort', key);
      next.set('dir', key === 'name' ? 'asc' : 'desc');
    }
    router.replace(`/projects?${next.toString()}`);
  };

  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-fg-tertiary">
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className={cn('px-4 py-2.5 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}
              >
                <button
                  onClick={() => setSort(c.key)}
                  className={cn(
                    'inline-flex items-center gap-1 hover:text-fg',
                    c.align === 'right' && 'flex-row-reverse',
                    sort === c.key && 'text-fg',
                  )}
                >
                  {c.label}
                  {sort === c.key ? (
                    dir === 'asc' ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )
                  ) : null}
                </button>
              </th>
            ))}
            <th className="px-4 py-2.5 text-left font-medium">Команда</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-surface-muted"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-fg">{p.name}</div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-tertiary">
                  <StatusBadge status={p.status} />
                  {p.clientName ? <span>{p.clientName}</span> : null}
                </div>
              </td>
              <td className="px-4 py-3 text-right nums">
                {formatRubStr(p.economics.factIncome)}
                <div className="text-xs text-fg-tertiary">план {formatRubStr(p.economics.planIncome)}</div>
              </td>
              <td className="px-4 py-3 text-right nums">
                {formatRubStr(p.economics.factExpense)}
                <div className="text-xs text-fg-tertiary">план {formatRubStr(p.economics.planExpense)}</div>
              </td>
              <td
                className={cn(
                  'px-4 py-3 text-right nums font-medium',
                  Number(p.economics.factProfit) < 0 ? 'text-negative' : 'text-fg',
                )}
              >
                {formatRubStr(p.economics.factProfit)}
              </td>
              <td className="px-4 py-3 text-right nums">
                {formatPercentStr(p.economics.factMargin)}
              </td>
              <td className="px-4 py-3">
                <div className="flex -space-x-2">
                  {p.members.slice(0, 4).map((m) => (
                    <Avatar key={m.id} className="size-6 ring-2 ring-surface" title={m.fullName}>
                      {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">{initials(m.fullName)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {p.members.length > 4 ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-surface-muted text-[10px] text-fg-tertiary ring-2 ring-surface">
                      +{p.members.length - 4}
                    </span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

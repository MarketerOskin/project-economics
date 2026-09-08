'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { formatRubStr, formatPercentStr } from '@/lib/format';
import { StatusBadge } from '@/components/projects/status-badge';
import type { DashboardData } from '@/server/services/dashboard';

export function DashboardProjectsTable({ projects }: { projects: DashboardData['projects'] }) {
  const router = useRouter();
  const rows = [...projects].sort(
    (a, b) => Number(b.economics.factProfit) - Number(a.economics.factProfit),
  );

  return (
    <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-fg-tertiary">
            <th className="px-4 py-2.5 text-left font-medium">Проект</th>
            <th className="px-4 py-2.5 text-left font-medium">Статус</th>
            <th className="px-4 py-2.5 text-right font-medium">Доход</th>
            <th className="px-4 py-2.5 text-right font-medium">Расход</th>
            <th className="px-4 py-2.5 text-right font-medium">Прибыль</th>
            <th className="px-4 py-2.5 text-right font-medium">Рентабельность</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-muted"
            >
              <td className="px-4 py-3 font-medium">{p.name}</td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status as 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'} />
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
                  Number(p.economics.factProfit) < 0 && 'text-negative',
                )}
              >
                {formatRubStr(p.economics.factProfit)}
              </td>
              <td className="px-4 py-3 text-right nums">{formatPercentStr(p.economics.factMargin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

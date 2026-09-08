'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { FilterMenu, type FilterGroup } from '@/components/common/filter-menu';
import { useFilterOptions } from '@/lib/client/filter-options';

export function FinanceFilters({
  basePath = '/finance',
  lockedProject = false,
}: {
  basePath?: string;
  /** True on the project finance tab — hide the project filter. */
  lockedProject?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const { projects, users, categories } = useFilterOptions();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    router.replace(`${basePath}?${next.toString()}`);
  };

  const direction = params.get('direction') ?? '';
  const budgetType = params.get('budgetType') ?? '';

  const groups: FilterGroup[] = [
    ...(lockedProject
      ? []
      : [{ key: 'projectId', label: 'Проект', allLabel: 'Все проекты', options: projects }]),
    { key: 'categoryId', label: 'Статья', allLabel: 'Все статьи', options: categories },
    { key: 'employeeId', label: 'Исполнитель', allLabel: 'Все исполнители', options: users },
    { key: 'authorId', label: 'Автор', allLabel: 'Все авторы', options: users },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Segmented
        value={direction}
        onChange={(v) => set({ direction: v || null })}
        options={[
          { value: '', label: 'Все' },
          { value: 'INCOME', label: 'Доходы' },
          { value: 'EXPENSE', label: 'Расходы' },
        ]}
      />
      <Segmented
        value={budgetType}
        onChange={(v) => set({ budgetType: v || null })}
        options={[
          { value: '', label: 'План и факт' },
          { value: 'PLAN', label: 'План' },
          { value: 'FACT', label: 'Факт' },
        ]}
      />
      <FilterMenu
        basePath={basePath}
        groups={groups}
        dateRange={{ fromKey: 'from', toKey: 'to', label: 'Период' }}
      />
      <div className="relative w-full sm:w-auto">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && set({ q: q || null })}
          onBlur={() => set({ q: q || null })}
          placeholder="Поиск по описанию"
          className="h-9 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:w-52"
        />
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath = '/finance',
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const go = (p: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(p));
    router.replace(`${basePath}?${next.toString()}`);
  };

  return (
    <div className="flex items-center justify-between text-sm text-fg-secondary">
      <span>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} из {total}
      </span>
      <div className="flex gap-1">
        <button
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          className="rounded-[8px] border border-border px-2.5 py-1 disabled:opacity-40"
        >
          Назад
        </button>
        <button
          disabled={page >= pages}
          onClick={() => go(page + 1)}
          className="rounded-[8px] border border-border px-2.5 py-1 disabled:opacity-40"
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}

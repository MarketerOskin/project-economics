'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';

const STATUS_TABS = [
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'COMPLETED', label: 'Завершённые' },
  { value: 'ARCHIVED', label: 'Архив' },
  { value: 'ALL', label: 'Все' },
] as const;

export function ProjectFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const status = params.get('status') ?? 'ACTIVE';
  const [q, setQ] = useState(params.get('q') ?? '');

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.replace(`/projects?${next.toString()}`));
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-[10px] border border-border bg-surface p-0.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => update({ status: t.value })}
            className={cn(
              'rounded-[8px] px-3 py-1.5 text-sm transition-colors',
              status === t.value
                ? 'bg-surface-muted font-medium text-fg shadow-sm'
                : 'text-fg-secondary hover:text-fg',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') update({ q: q || null });
          }}
          onBlur={() => update({ q: q || null })}
          placeholder="Поиск по названию"
          className="h-9 w-64 rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </div>
  );
}

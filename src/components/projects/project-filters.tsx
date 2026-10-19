'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { STREAM_KINDS, STREAM_KIND_LABELS } from '@/lib/streams';

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
  const kind = params.get('kind') ?? '';
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="border-border bg-surface inline-flex rounded-full border p-0.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => update({ status: t.value })}
              className={cn(
                'h-8 rounded-full px-3.5 text-sm transition-colors',
                status === t.value
                  ? 'bg-button-primary text-button-primary-fg font-semibold'
                  : 'text-fg-secondary hover:text-fg',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="text-fg-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') update({ q: q || null });
            }}
            onBlur={() => update({ q: q || null })}
            placeholder="Поиск по названию"
            className="border-border bg-surface focus-visible:ring-accent h-9 w-64 rounded-full border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" aria-label="Направление">
        <span className="text-fg-tertiary mr-1.5 font-mono text-[11px] tracking-[0.06em] uppercase">
          Направление
        </span>
        {[
          { value: '', label: 'Все' },
          ...STREAM_KINDS.map((k) => ({ value: k, label: STREAM_KIND_LABELS[k] })),
        ].map((t) => (
          <button
            key={t.value || 'all'}
            onClick={() => update({ kind: t.value || null })}
            className={cn(
              'h-7 border px-2.5 text-xs transition-colors',
              kind === t.value
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border text-fg-secondary hover:text-accent',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

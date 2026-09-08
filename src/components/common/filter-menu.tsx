'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/field';

export interface FilterGroup {
  /** Query-param key. */
  key: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}

export interface DateRangeFilter {
  fromKey: string;
  toKey: string;
  label: string;
}

/**
 * Generic URL-synced filter dropdown used on the dashboard and the finance ledger.
 * Single-select per group + an optional date range.
 */
export function FilterMenu({
  basePath,
  groups,
  dateRange,
}: {
  basePath: string;
  groups: FilterGroup[];
  dateRange?: DateRangeFilter;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    next.delete('page');
    router.replace(`${basePath}?${next.toString()}`);
  };

  const allKeys = [
    ...groups.map((g) => g.key),
    ...(dateRange ? [dateRange.fromKey, dateRange.toKey] : []),
  ];
  const activeKeys = allKeys.filter((k) => params.get(k));
  const get = (k: string) => params.get(k) ?? '';

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
            activeKeys.length > 0
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface',
          )}
        >
          <SlidersHorizontal className="size-4" />
          Фильтры
          {activeKeys.length > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-xs text-accent-fg">
              {activeKeys.length}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[70vh] w-64 overflow-y-auto">
          {dateRange ? (
            <>
              <DropdownMenuLabel>{dateRange.label}</DropdownMenuLabel>
              <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                <Input
                  type="date"
                  value={get(dateRange.fromKey)}
                  onChange={(e) => set({ [dateRange.fromKey]: e.target.value || null })}
                  className="h-8"
                />
                <span className="text-fg-tertiary">—</span>
                <Input
                  type="date"
                  value={get(dateRange.toKey)}
                  onChange={(e) => set({ [dateRange.toKey]: e.target.value || null })}
                  className="h-8"
                />
              </div>
              <DropdownMenuSeparator />
            </>
          ) : null}

          {groups.map((g) => (
            <React.Fragment key={g.key}>
              <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={get(g.key) === ''}
                onSelect={(e) => {
                  e.preventDefault();
                  set({ [g.key]: null });
                }}
              >
                {g.allLabel}
              </DropdownMenuCheckboxItem>
              {g.options.map((o) => (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={get(g.key) === o.value}
                  onSelect={(e) => {
                    e.preventDefault();
                    set({ [g.key]: get(g.key) === o.value ? null : o.value });
                  }}
                >
                  {o.label}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {activeKeys.length > 0 ? (
        <button
          onClick={() => set(Object.fromEntries(activeKeys.map((k) => [k, null])))}
          className="inline-flex h-9 items-center rounded-[10px] border border-border bg-surface px-2.5 text-sm text-fg-secondary hover:text-fg"
          aria-label="Сбросить фильтры"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

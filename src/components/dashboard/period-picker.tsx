'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import { PERIOD_LABELS, type PeriodPreset } from '@/lib/period';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/field';

const PRESETS: PeriodPreset[] = [
  'this_month',
  'last_month',
  'this_quarter',
  'this_year',
  'all_time',
  'custom',
];

export function PeriodPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const preset = (params.get('preset') ?? 'this_year') as PeriodPreset;

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`/?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
          <CalendarDays className="size-4 text-fg-tertiary" />
          {PERIOD_LABELS[preset]}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PRESETS.map((p) => (
            <DropdownMenuCheckboxItem
              key={p}
              checked={preset === p}
              onSelect={(e) => {
                e.preventDefault();
                setParam({ preset: p, ...(p !== 'custom' ? { from: null, to: null } : {}) });
              }}
            >
              {PERIOD_LABELS[p]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {preset === 'custom' ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            defaultValue={params.get('from') ?? ''}
            onChange={(e) => setParam({ from: e.target.value || null })}
            className="h-9 w-[9.5rem]"
          />
          <span className="text-fg-tertiary">—</span>
          <Input
            type="date"
            defaultValue={params.get('to') ?? ''}
            onChange={(e) => setParam({ to: e.target.value || null })}
            className="h-9 w-[9.5rem]"
          />
        </div>
      ) : null}
    </div>
  );
}

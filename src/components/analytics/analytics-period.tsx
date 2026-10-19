'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';
import { PRESET_LABELS, adjacentMonths, type AnalyticsPreset } from '@/domain/analytics/period';

const QUICK: AnalyticsPreset[] = ['today', '7d', '30d', '90d', 'month', 'custom'];

/** URL-synced period control for every analytics page: quick ranges, month stepping, custom range. */
export function AnalyticsPeriod({
  preset,
  label,
  month,
}: {
  preset: AnalyticsPreset;
  label: string;
  month?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const href = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete('refresh');
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const nav = month ? adjacentMonths(month) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="border-border bg-surface-muted inline-flex flex-wrap rounded-full border p-0.5"
        role="tablist"
      >
        {QUICK.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={preset === p}
            onClick={() =>
              router.replace(
                href(
                  p === 'month'
                    ? { p: null, m: null, from: null, to: null }
                    : p === 'custom'
                      ? { p: 'custom' }
                      : { p, m: null, from: null, to: null },
                ),
              )
            }
            className={cn(
              'rounded-full px-3 py-1.5 text-[13px] transition-colors',
              preset === p
                ? 'bg-button-primary text-button-primary-fg font-semibold'
                : 'text-fg-secondary hover:text-fg',
            )}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {nav ? (
        <div className="border-border bg-surface inline-flex items-center rounded-full border">
          <Link
            href={href({ p: null, m: nav.prev })}
            className="text-fg-secondary hover:text-accent px-2 py-2"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <span className="min-w-[8.5rem] text-center text-sm">{label}</span>
          <Link
            href={href({ p: null, m: nav.next })}
            className="text-fg-secondary hover:text-accent px-2 py-2"
            aria-label="Следующий месяц"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
      ) : preset === 'custom' ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            defaultValue={params.get('from') ?? ''}
            onChange={(e) =>
              e.target.value && router.replace(href({ p: 'custom', from: e.target.value }))
            }
            className="h-9 w-[9.5rem]"
          />
          <span className="text-fg-tertiary">—</span>
          <Input
            type="date"
            defaultValue={params.get('to') ?? ''}
            onChange={(e) =>
              e.target.value && router.replace(href({ p: 'custom', to: e.target.value }))
            }
            className="h-9 w-[9.5rem]"
          />
        </div>
      ) : (
        <span className="text-fg-secondary text-sm">{label}</span>
      )}

      <Link
        href={href({ refresh: '1' })}
        className="border-border bg-surface text-fg-secondary hover:text-accent inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm"
        title="Загрузить свежие данные из Битрикс24"
      >
        <RefreshCw className="size-3.5" />
        Обновить
      </Link>
    </div>
  );
}

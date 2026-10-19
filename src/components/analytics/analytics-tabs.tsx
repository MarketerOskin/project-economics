'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/analytics', label: 'Обзор' },
  { href: '/analytics/team', label: 'Сотрудники' },
  { href: '/analytics/meetings', label: 'Встречи' },
];

/** Sub-navigation of «Аналитика»; carries the period (not one-shot params) between tabs. */
export function AnalyticsTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ['p', 'm', 'from', 'to']) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();

  return (
    <div className="overflow-x-auto px-4 pt-2 sm:px-8">
      <nav className="flex gap-1 sm:gap-2">
        {TABS.map((t) => {
          const active =
            t.href === '/analytics' ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={qs ? `${t.href}?${qs}` : t.href}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
                active
                  ? 'bg-surface-muted text-fg border-border border'
                  : 'text-fg-tertiary hover:text-fg hover:bg-surface-muted/60',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

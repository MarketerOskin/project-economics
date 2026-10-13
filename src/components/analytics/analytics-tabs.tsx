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
    <div className="border-border overflow-x-auto border-b px-4 sm:px-8">
      <nav className="flex gap-5 sm:gap-6">
        {TABS.map((t) => {
          const active =
            t.href === '/analytics' ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={qs ? `${t.href}?${qs}` : t.href}
              className={cn(
                '-mb-px border-b-2 py-2.5 text-sm transition-colors',
                active
                  ? 'border-accent text-fg font-medium'
                  : 'text-fg-secondary hover:text-fg border-transparent',
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

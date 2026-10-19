'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Sub-navigation of a section. The period (not one-shot params) carries between tabs; the
 * most specific tab whose href starts the path is the active one. On desktop the tabs sit in
 * the top bar, so only the aside stays in this row.
 */
export function SectionTabs({
  tabs,
  aside,
}: {
  tabs: Array<{ href: string; label: string }>;
  /** Shown on the right of the tab row. */
  aside?: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const keep = new URLSearchParams();
  for (const k of ['p', 'm', 'from', 'to', 'preset']) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();
  const active = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 overflow-x-auto px-4 pt-2 sm:px-8 lg:justify-end',
        !aside && 'lg:hidden',
      )}
    >
      <nav className="flex gap-1 sm:gap-2 lg:hidden">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={qs ? `${t.href}?${qs}` : t.href}
            aria-current={t.href === active ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
              t.href === active
                ? 'bg-surface-muted text-fg border-border border'
                : 'text-fg-tertiary hover:text-fg hover:bg-surface-muted/60',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {aside}
    </div>
  );
}

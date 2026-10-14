'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Sub-navigation of a section. The period (not one-shot params) carries between tabs; the
 * most specific tab whose href starts the path is the active one.
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
    <div className="border-border bg-surface flex items-center justify-between gap-4 overflow-x-auto border-b-2 px-4 sm:px-8">
      <nav className="flex gap-1 sm:gap-2">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={qs ? `${t.href}?${qs}` : t.href}
            aria-current={t.href === active ? 'page' : undefined}
            className={cn(
              '-mb-0.5 border-b-[3px] px-3 py-3.5 text-base font-medium whitespace-nowrap transition-colors sm:px-4',
              t.href === active
                ? 'border-accent text-accent bg-accent/10'
                : 'text-fg hover:bg-surface-muted hover:border-border border-transparent',
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

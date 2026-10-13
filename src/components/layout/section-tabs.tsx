'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';

/**
 * Sub-navigation of a section. The period (not one-shot params) carries between tabs; the
 * most specific tab whose href starts the path is the active one.
 */
export function SectionTabs({ tabs }: { tabs: Array<{ href: string; label: string }> }) {
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
    <div className="border-border overflow-x-auto border-b px-4 sm:px-8">
      <nav className="flex gap-5 sm:gap-6">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={qs ? `${t.href}?${qs}` : t.href}
            className={cn(
              '-mb-px border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors',
              t.href === active
                ? 'border-accent text-fg font-medium'
                : 'text-fg-secondary hover:text-fg border-transparent',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

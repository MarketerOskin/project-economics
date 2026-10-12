'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export function ProjectTabs({
  projectId,
  canViewHistory,
  canViewAnalytics = false,
}: {
  projectId: string;
  canViewHistory: boolean;
  canViewAnalytics?: boolean;
}) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: 'Обзор' },
    { href: `${base}/finance`, label: 'Финансы' },
    { href: `${base}/team`, label: 'Команда' },
    ...(canViewAnalytics ? [{ href: `${base}/analytics`, label: 'Аналитика' }] : []),
    ...(canViewHistory ? [{ href: `${base}/history`, label: 'История' }] : []),
  ];

  return (
    <div className="overflow-x-auto border-b border-border px-4 sm:px-8">
      <nav className="flex gap-5 sm:gap-6">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                '-mb-px border-b-2 py-2.5 text-sm transition-colors',
                active
                  ? 'border-accent font-medium text-fg'
                  : 'border-transparent text-fg-secondary hover:text-fg',
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

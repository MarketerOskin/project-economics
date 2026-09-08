'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export function ProjectTabs({ projectId, canViewHistory }: { projectId: string; canViewHistory: boolean }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: 'Обзор' },
    { href: `${base}/finance`, label: 'Финансы' },
    { href: `${base}/team`, label: 'Команда' },
    ...(canViewHistory ? [{ href: `${base}/history`, label: 'История' }] : []),
  ];

  return (
    <div className="border-b border-border px-8">
      <nav className="flex gap-6">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname === t.href;
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

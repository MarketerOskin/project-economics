'use client';

import { motion } from 'motion/react';
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
    ...(canViewAnalytics ? [{ href: `${base}/analytics`, label: 'Аналитика' }] : []),
    { href: `${base}/finance`, label: 'Финансы' },
    { href: `${base}/team`, label: 'Команда' },
    ...(canViewHistory ? [{ href: `${base}/history`, label: 'История' }] : []),
  ];

  return (
    <div className="border-border overflow-x-auto border-b px-4 sm:px-8">
      <nav className="flex gap-5 sm:gap-6">
        {tabs.map((t) => {
          const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'relative -mb-px py-2.5 text-sm transition-colors',
                active ? 'text-fg font-medium' : 'text-fg-secondary hover:text-fg',
              )}
            >
              {t.label}
              {/* The underline slides to the open tab (ADR-065). */}
              {active ? (
                <motion.span
                  layoutId="project-tab"
                  aria-hidden
                  className="bg-accent absolute inset-x-0 bottom-0 h-0.5 rounded-full shadow-[0_0_10px_var(--accent)] in-data-[theme=light]:shadow-none"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

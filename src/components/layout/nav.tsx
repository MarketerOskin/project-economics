'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@prisma/client';
import { LayoutDashboard, FolderKanban, Receipt, Tags, History, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
}

const ITEMS: NavItem[] = [
  { href: '/', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/projects', label: 'Проекты', icon: FolderKanban },
  { href: '/finance', label: 'Финансы', icon: Receipt },
  { href: '/settings/categories', label: 'Статьи', icon: Tags, roles: ['ADMIN', 'MANAGER'] },
  { href: '/history', label: 'История', icon: History, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings', label: 'Настройки', icon: Settings, roles: ['ADMIN'] },
];

export function Nav({ role }: { role: AppRole }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.filter((i) => !i.roles || i.roles.includes(role)).map((item) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-surface font-medium text-fg shadow-sm'
                : 'text-fg-secondary hover:bg-surface/60 hover:text-fg',
            )}
          >
            <Icon className="size-[18px]" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

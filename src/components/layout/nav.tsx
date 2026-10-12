'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@prisma/client';
import { LayoutDashboard, FolderKanban, Receipt, Tags, History, Settings, Sparkles, HelpCircle, Timer, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  /** Match the pathname exactly rather than by prefix (avoids /settings lighting up on /settings/categories). */
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/projects', label: 'Проекты', icon: FolderKanban },
  { href: '/finance', label: 'Финансы', icon: Receipt },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
  { href: '/automation', label: 'Автоматизация', icon: Timer, roles: ['ADMIN', 'MANAGER'] },
  { href: '/sales-funnels', label: 'Продажи по воронкам', icon: TrendingUp, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings/categories', label: 'Статьи', icon: Tags, roles: ['ADMIN', 'MANAGER'] },
  { href: '/history', label: 'История', icon: History, roles: ['ADMIN', 'MANAGER'] },
  { href: '/pricing', label: 'Тарифы', icon: Sparkles, roles: ['ADMIN', 'MANAGER'] },
  { href: '/settings', label: 'Настройки', icon: Settings, roles: ['ADMIN'], exact: true },
  { href: '/how-it-works', label: 'Как это работает', icon: HelpCircle },
];

export function Nav({ role, onNavigate }: { role: AppRole; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {ITEMS.filter((i) => !i.roles || i.roles.includes(role)).map((item) => {
        const active =
          item.href === '/' || item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 border-l-2 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.04em] transition-colors',
              active
                ? 'border-accent bg-accent font-bold text-accent-fg'
                : 'border-transparent text-fg-secondary hover:border-accent hover:text-accent',
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

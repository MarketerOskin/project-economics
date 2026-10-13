'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@prisma/client';
import {
  FolderKanban,
  Receipt,
  History,
  Settings,
  Sparkles,
  HelpCircle,
  LifeBuoy,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { sectionOfPath } from '@/lib/sections';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  /** Match the pathname exactly rather than by prefix (avoids /settings lighting up on /settings/categories). */
  exact?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/analytics', label: 'Аналитика', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
  {
    href: '/marketing',
    label: 'Маркетинг и продажи',
    icon: TrendingUp,
    roles: ['ADMIN', 'MANAGER'],
  },
  { href: '/projects', label: 'Проекты', icon: FolderKanban },
  { href: '/finance', label: 'Финансы', icon: Receipt },
  { href: '/settings', label: 'Настройки', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
  { href: '/how-it-works', label: 'Как это работает', icon: HelpCircle },
  { href: '/implementation', label: 'Заявка на внедрение', icon: LifeBuoy },
];

/** Bottom of the sidebar, next to the theme switch: history and plans (plans highlighted). */
const FOOTER_ITEMS: NavItem[] = [
  { href: '/history', label: 'История', icon: History, roles: ['ADMIN', 'MANAGER'] },
  { href: '/pricing', label: 'Тарифы', icon: Sparkles, roles: ['ADMIN', 'MANAGER'] },
];

export function Nav({
  role,
  disabled = [],
  onNavigate,
}: {
  role: AppRole;
  disabled?: string[];
  onNavigate?: () => void;
}) {
  return <NavList items={ITEMS} role={role} disabled={disabled} onNavigate={onNavigate} />;
}

export function NavFooter({
  role,
  disabled = [],
  onNavigate,
}: {
  role: AppRole;
  disabled?: string[];
  onNavigate?: () => void;
}) {
  return (
    <NavList items={FOOTER_ITEMS} role={role} disabled={disabled} onNavigate={onNavigate} footer />
  );
}

function NavList({
  items: all,
  role,
  disabled,
  onNavigate,
  footer = false,
}: {
  items: NavItem[];
  role: AppRole;
  disabled: string[];
  onNavigate?: () => void;
  footer?: boolean;
}) {
  const pathname = usePathname();
  const items = all.filter(
    (i) => (!i.roles || i.roles.includes(role)) && !disabled.includes(sectionOfPath(i.href) ?? ''),
  );
  // The most specific item wins.
  const matches = (i: NavItem) =>
    i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
  const activeHref = items.filter(matches).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        const highlight = footer && item.href === '/pricing' && !active;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 border-l-2 px-3 py-2 font-mono text-[12px] tracking-[0.04em] uppercase transition-colors',
              active
                ? 'border-accent bg-accent text-accent-fg font-bold'
                : highlight
                  ? 'border-accent text-accent hover:bg-accent hover:text-accent-fg font-bold'
                  : 'text-fg-secondary hover:border-accent hover:text-accent border-transparent',
              footer && 'py-1.5',
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

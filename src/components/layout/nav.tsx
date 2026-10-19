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
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { sectionOfPath } from '@/lib/sections';

interface SubItem {
  href: string;
  label: string;
  /** Active only on this exact path (the section's own landing tab). */
  exact?: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  /** Match the pathname exactly rather than by prefix (avoids /settings lighting up on /settings/categories). */
  exact?: boolean;
  /** Lights up for every path under this prefix (Финансы opens on Обзор, but covers /finance). */
  section?: string;
  /** The section's screens, listed inside its card while the section is open (ADR-062). */
  items?: SubItem[];
}

const ITEMS: NavItem[] = [
  {
    href: '/analytics',
    label: 'Аналитика',
    icon: BarChart3,
    roles: ['ADMIN', 'MANAGER'],
    items: [
      { href: '/analytics', label: 'Обзор', exact: true },
      { href: '/analytics/team', label: 'Сотрудники' },
      { href: '/analytics/meetings', label: 'Встречи' },
    ],
  },
  {
    href: '/marketing',
    label: 'Маркетинг и продажи',
    icon: TrendingUp,
    roles: ['ADMIN', 'MANAGER'],
    items: [
      { href: '/marketing', label: 'Маркетинг', exact: true },
      { href: '/marketing/sales', label: 'Продажи' },
      { href: '/marketing/funnels', label: 'Продажи и обращения' },
    ],
  },
  { href: '/projects', label: 'Проекты', icon: FolderKanban },
  {
    href: '/finance/overview',
    section: '/finance',
    label: 'Финансы',
    icon: Receipt,
    items: [
      { href: '/finance/overview', label: 'Обзор' },
      { href: '/finance', label: 'Операции' },
    ],
  },
  { href: '/settings', label: 'Настройки', icon: Settings, roles: ['ADMIN', 'MANAGER'] },
  { href: '/how-it-works', label: 'Как это работает', icon: HelpCircle },
  { href: '/implementation', label: 'Заявка на внедрение', icon: LifeBuoy },
];

/** Bottom of the sidebar, next to the theme switch: history and plans (plans highlighted). */
const FOOTER_ITEMS: NavItem[] = [
  { href: '/history', label: 'История', icon: History, roles: ['ADMIN', 'MANAGER'] },
  { href: '/pricing', label: 'Тарифы', icon: Sparkles, roles: ['ADMIN', 'MANAGER'] },
];

const matches = (pathname: string, i: NavItem) => {
  const base = i.section ?? i.href;
  return i.exact ? pathname === i.href : pathname === base || pathname.startsWith(`${base}/`);
};

/** The most specific item that covers the path. */
function activeItem(items: NavItem[], pathname: string): NavItem | undefined {
  return items
    .filter((i) => matches(pathname, i))
    .sort((a, b) => (b.section ?? b.href).length - (a.section ?? a.href).length)[0];
}

/** Name of the section the path is in, for the top bar. */
export function sectionLabel(pathname: string): string | null {
  return activeItem([...ITEMS, ...FOOTER_ITEMS], pathname)?.label ?? null;
}

/** The most specific sub-item that covers the path (Операции is /finance, a prefix of Обзор). */
function activeSubItem(items: SubItem[], pathname: string): string | undefined {
  return items
    .filter((s) =>
      s.exact ? pathname === s.href : pathname === s.href || pathname.startsWith(`${s.href}/`),
    )
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Screens of the section the path is in, shown as tabs in the top bar. */
export function sectionTabs(pathname: string): { tabs: SubItem[]; active?: string } {
  const tabs = activeItem(ITEMS, pathname)?.items ?? [];
  return { tabs, active: activeSubItem(tabs, pathname) };
}

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

/** LifeRM side navigation: every section is a translucent card; the open one lists its screens. */
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
  const activeHref = activeItem(items, pathname)?.href;

  return (
    <nav className={cn('flex flex-col', footer ? 'gap-1' : 'gap-2')}>
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        const highlight = footer && item.href === '/pricing' && !active;
        const sub = active ? item.items : undefined;
        const activeSub = sub ? activeSubItem(sub, pathname) : undefined;
        return (
          <div
            key={item.href}
            className={cn(
              'overflow-hidden rounded-2xl border transition-colors',
              active
                ? 'border-white/[0.14] bg-white/[0.09]'
                : 'border-white/[0.08] bg-white/[0.05]',
              !active && 'hover:bg-white/[0.08]',
            )}
          >
            <Link
              href={item.href}
              onClick={onNavigate}
              data-nav-section
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 px-3 text-sm font-medium transition-colors',
                footer ? 'h-10' : 'h-[46px]',
                active ? 'text-fg' : highlight ? 'text-accent' : 'text-fg-tertiary hover:text-fg',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
              {item.items ? (
                <ChevronDown
                  className={cn('size-3.5 shrink-0 transition-transform', active && 'rotate-180')}
                />
              ) : active ? (
                <span aria-hidden className="bg-button-primary size-1.5 rounded-full" />
              ) : null}
            </Link>
            {sub ? (
              <div className="flex flex-col gap-0.5 border-t border-white/[0.06] p-1.5">
                {sub.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={onNavigate}
                    aria-current={s.href === activeSub ? 'page' : undefined}
                    className={cn(
                      'rounded-[10px] py-2 pr-2.5 pl-9 text-[13px] transition-colors',
                      s.href === activeSub
                        ? 'text-fg bg-white/10 font-medium'
                        : 'text-fg-tertiary hover:text-fg hover:bg-white/[0.05]',
                    )}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

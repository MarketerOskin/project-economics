'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AppRole } from '@prisma/client';
import {
  FolderKanban,
  Receipt,
  Settings,
  MoreHorizontal,
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
  roles?: AppRole[];
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
  /** A grouping card (Ещё): the top bar names the open screen, not the group, and shows no tabs. */
  group?: boolean;
}

const MANAGERS: AppRole[] = ['ADMIN', 'MANAGER'];

/** The side menu as in the Figma mockups (ADR-064). */
const ITEMS: NavItem[] = [
  {
    href: '/analytics',
    label: 'Аналитика',
    icon: BarChart3,
    roles: MANAGERS,
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
    roles: MANAGERS,
    items: [
      { href: '/marketing', label: 'Маркетинг', exact: true },
      { href: '/marketing/sales', label: 'Продажи' },
      { href: '/marketing/funnels', label: 'Продажи и обращения' },
    ],
  },
  {
    href: '/projects',
    label: 'Проекты',
    icon: FolderKanban,
    items: [
      { href: '/projects', label: 'Список проектов' },
      { href: '/projects/new', label: 'Новый проект', roles: MANAGERS },
    ],
  },
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
  {
    href: '/settings',
    label: 'Настройки',
    icon: Settings,
    roles: MANAGERS,
    items: [
      { href: '/settings', label: 'Основные' },
      { href: '/settings/stages', label: 'Стадии CRM' },
      { href: '/history', label: 'История изменений' },
      { href: '/pricing', label: 'Тарифы' },
    ],
  },
];

/** Bottom of the sidebar, above the demo role and the theme switch. */
const FOOTER_ITEMS: NavItem[] = [
  {
    href: '/how-it-works',
    label: 'Ещё',
    icon: MoreHorizontal,
    group: true,
    items: [
      { href: '/how-it-works', label: 'Как это работает' },
      { href: '/implementation', label: 'Заявка на внедрение' },
    ],
  },
];

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

const subMatches = (pathname: string, s: SubItem) =>
  s.exact ? pathname === s.href : under(pathname, s.href);

/** Length of the most specific prefix of the item (or of one of its screens) that covers the path. */
function matchLength(pathname: string, i: NavItem): number {
  const base = i.section ?? i.href;
  let best = (i.exact ? pathname === i.href : under(pathname, base)) ? base.length : -1;
  for (const s of i.items ?? []) if (subMatches(pathname, s)) best = Math.max(best, s.href.length);
  return best;
}

/** The most specific item that covers the path. */
function activeItem(items: NavItem[], pathname: string): NavItem | undefined {
  return items
    .map((i) => [i, matchLength(pathname, i)] as const)
    .filter(([, n]) => n >= 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** The most specific sub-item that covers the path (Операции is /finance, a prefix of Обзор). */
function activeSubItem(items: SubItem[], pathname: string): string | undefined {
  return items
    .filter((s) => subMatches(pathname, s))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

const visibleSubs = (items: SubItem[] | undefined, role: AppRole | undefined, disabled: string[]) =>
  (items ?? []).filter(
    (s) =>
      (!s.roles || !role || s.roles.includes(role)) &&
      !disabled.includes(sectionOfPath(s.href) ?? ''),
  );

/** Name of the section the path is in, for the top bar. */
export function sectionLabel(pathname: string): string | null {
  const item = activeItem([...ITEMS, ...FOOTER_ITEMS], pathname);
  if (!item) return null;
  if (item.group) {
    const sub = activeSubItem(item.items ?? [], pathname);
    return item.items?.find((s) => s.href === sub)?.label ?? item.label;
  }
  return item.label;
}

/** Screens of the section the path is in, shown as tabs in the top bar. */
export function sectionTabs(
  pathname: string,
  role?: AppRole,
  disabled: string[] = [],
): { tabs: SubItem[]; active?: string } {
  const item = activeItem(ITEMS, pathname);
  const tabs = visibleSubs(item?.items, role, disabled);
  return { tabs: tabs.length > 1 ? tabs : [], active: activeSubItem(tabs, pathname) };
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
  return <NavList items={FOOTER_ITEMS} role={role} disabled={disabled} onNavigate={onNavigate} />;
}

/** LifeRM side navigation: every section is a translucent card; the open one lists its screens. */
function NavList({
  items: all,
  role,
  disabled,
  onNavigate,
}: {
  items: NavItem[];
  role: AppRole;
  disabled: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = all.filter(
    (i) => (!i.roles || i.roles.includes(role)) && !disabled.includes(sectionOfPath(i.href) ?? ''),
  );
  const activeHref = activeItem(items, pathname)?.href;

  return (
    <nav className="flex flex-col gap-2">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        const subs = visibleSubs(item.items, role, disabled);
        const sub = active && subs.length > 0 ? subs : undefined;
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
              aria-current={active && !item.group ? 'page' : undefined}
              className={cn(
                'flex h-[46px] items-center gap-2.5 px-3 text-sm font-medium transition-colors',
                active ? 'text-fg' : 'text-fg-tertiary hover:text-fg',
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
              {subs.length > 0 ? (
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

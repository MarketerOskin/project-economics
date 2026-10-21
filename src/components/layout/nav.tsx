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
import { AnimatePresence, motion } from 'motion/react';
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
              'relative isolate overflow-hidden rounded-2xl border transition-colors duration-300',
              active
                ? 'border-[#d6ff3f]/25 in-data-[theme=light]:border-black/[0.06]'
                : 'border-white/[0.07] bg-white/[0.035] hover:border-white/[0.12] hover:bg-white/[0.07] in-data-[theme=light]:border-black/[0.06] in-data-[theme=light]:bg-black/[0.02] in-data-[theme=light]:hover:border-black/[0.08] in-data-[theme=light]:hover:bg-black/[0.04]',
            )}
          >
            {/* The lit card glides from section to section (ADR-065). */}
            {active ? (
              <motion.span
                layoutId={`nav-active-${items[0]?.href ?? ''}`}
                aria-hidden
                className="absolute inset-0 -z-10 bg-[linear-gradient(140deg,rgb(214_255_63/0.13),rgb(255_255_255/0.06)_45%,rgb(124_92_255/0.1))] in-data-[theme=light]:bg-black/[0.06] in-data-[theme=light]:bg-none"
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              />
            ) : null}
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
              <Icon
                className={cn(
                  'size-4 shrink-0 transition-[color,transform] duration-300',
                  active && 'scale-110 text-[#d6ff3f] in-data-[theme=light]:text-[#1d1d1f]',
                )}
              />
              <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
              {subs.length > 0 ? (
                <ChevronDown
                  className={cn(
                    'size-3.5 shrink-0 transition-transform duration-300',
                    active && 'rotate-180',
                  )}
                />
              ) : active ? (
                <span aria-hidden className="bg-button-primary size-1.5 rounded-full" />
              ) : null}
            </Link>
            <AnimatePresence initial={false}>
              {sub ? (
                <motion.div
                  key="sub"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-col gap-0.5 border-t border-white/[0.06] p-1.5 in-data-[theme=light]:border-black/[0.05]">
                    {sub.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        onClick={onNavigate}
                        aria-current={s.href === activeSub ? 'page' : undefined}
                        className={cn(
                          'relative rounded-[10px] py-2 pr-2.5 pl-9 text-[13px] transition-colors',
                          s.href === activeSub
                            ? 'text-fg font-medium'
                            : 'text-fg-tertiary hover:text-fg hover:bg-white/[0.05] in-data-[theme=light]:hover:bg-black/[0.04]',
                        )}
                      >
                        {s.href === activeSub ? (
                          <motion.span
                            layoutId={`nav-sub-${item.href}`}
                            aria-hidden
                            className="absolute inset-0 -z-10 rounded-[10px] bg-white/10 in-data-[theme=light]:bg-black/[0.06]"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          >
                            <span className="absolute top-1/2 left-4 size-1.5 -translate-y-1/2 rounded-full bg-[#d6ff3f] shadow-[0_0_8px_rgb(214_255_63/0.8)] in-data-[theme=light]:bg-[#1d1d1f] in-data-[theme=light]:shadow-none" />
                          </motion.span>
                        ) : null}
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}

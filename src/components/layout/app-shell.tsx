'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, Menu, X } from 'lucide-react';
import { useSession } from '@/lib/client/session';
import { cn } from '@/lib/cn';
import { Nav, NavFooter, sectionLabel, sectionTabs } from './nav';
import { UserBadge } from './user-badge';
import { DemoRoleSwitch } from './demo-role-switch';
import { ThemeToggle } from './theme-toggle';
import { TableSort } from './table-sort';
import { BugReportButton } from '@/components/support/bug-report-button';
import { useViewportBand } from '@/lib/client/viewport-band';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // Inside Bitrix24 the iframe is as tall as the page, so `h-screen`/sticky pin the menu to
  // the whole page; keep the menu in the slice the user actually sees instead (ADR-059).
  const band = useViewportBand();
  // On desktop outside Bitrix24 the shell is exactly one screen tall: the menu and the top bar
  // stay put and only the page area scrolls.
  const pinned = !band;

  // Nav links and the logo call this on click, so the drawer closes on navigation.
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  // Close on Escape while the drawer is open.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  return (
    <div
      className={cn(
        'bg-bg flex min-h-screen print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white',
        pinned && 'lg:h-screen lg:overflow-hidden',
      )}
    >
      {/* Backdrop — mobile only, only when the drawer is open. */}
      {drawerOpen ? (
        <div
          aria-hidden
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      ) : null}

      {/* One sidebar: a floating dark panel on ≥ lg, a slide-in drawer below it. The panel is
          dark in both themes, as in LifeRM (ADR-062), hence the `theme-dark` token scope. */}
      <aside
        className={cn(
          'theme-dark fixed inset-y-0 left-0 z-50 w-64 shrink-0 p-2 transition-transform duration-200 print:hidden',
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-60 lg:py-4 lg:pr-0 lg:pl-4 lg:transition-none',
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={band ? { height: 'auto' } : undefined}
      >
        <div
          className="text-fg relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.07] bg-[#050505]"
          style={
            band
              ? {
                  position: 'absolute',
                  left: 16,
                  right: 0,
                  top: band.top + 16,
                  height: band.height - 32,
                }
              : undefined
          }
        >
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Закрыть меню"
            className="text-fg-tertiary hover:text-fg absolute top-4 right-3 rounded-lg p-1.5 hover:bg-white/5 lg:hidden"
          >
            <X className="size-4" />
          </button>

          <Link
            href="/"
            className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4"
            onClick={closeDrawer}
          >
            <BrandMark />
            <div className="min-w-0">
              <div className="truncate text-sm leading-tight font-bold">Экономика проектов</div>
              <div className="text-fg-tertiary mt-0.5 truncate text-[11px]">Токсичная компания</div>
            </div>
          </Link>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3">
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-[46px] animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : session ? (
              <Nav
                role={session.role}
                disabled={session.disabledSections ?? []}
                onNavigate={closeDrawer}
              />
            ) : null}

            <div className="mt-auto flex flex-col gap-2 border-t border-white/[0.07] pt-3">
              {session ? (
                <NavFooter
                  role={session.role}
                  disabled={session.disabledSections ?? []}
                  onNavigate={closeDrawer}
                />
              ) : null}
              <DemoRoleSwitch />
              <div className="flex items-center justify-between gap-2 pr-1 pl-2">
                <span className="text-fg-tertiary text-[11px]">Панель закреплена</span>
                <ThemeToggle />
              </div>
              <div className="px-1 lg:hidden">
                <UserBadge />
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col print:block print:h-auto print:overflow-visible',
          pinned && 'lg:h-screen',
        )}
      >
        {/* Mobile top bar (< lg) */}
        <header className="border-border bg-bg/90 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={drawerOpen}
            className="text-fg-secondary hover:bg-surface hover:text-fg -ml-1 rounded-lg p-1.5"
          >
            <Menu className="size-5" />
          </button>
          <BrandMark small />
          <span className="text-[15px] font-bold">Экономика проектов</span>
        </header>

        {/* Desktop top bar: the current section and the user, as in LifeRM. */}
        {session ? <TopBar /> : null}

        <main
          className={cn(
            'min-w-0 flex-1 lg:pr-4 print:overflow-visible',
            pinned && 'lg:min-h-0 lg:overflow-y-auto',
          )}
        >
          {children}
          <TableSort />
        </main>
      </div>

      {session ? (
        <div className="print:hidden">
          <BugReportButton />
        </div>
      ) : null}
    </div>
  );
}

function TopBar() {
  const pathname = usePathname();
  const label = sectionLabel(pathname);
  return (
    <div className="hidden shrink-0 px-8 pt-4 pb-2 lg:block lg:pr-12 print:hidden">
      <div className="border-border bg-surface flex h-[66px] items-center gap-4 rounded-[18px] border pr-2.5 pl-5">
        <span aria-hidden className="bg-button-primary size-2 rounded-full" />
        <span className="shrink-0 truncate text-base font-bold">
          {label ?? 'Экономика проектов'}
        </span>
        <React.Suspense fallback={<span className="flex-1" />}>
          <TopBarTabs pathname={pathname} />
        </React.Suspense>
        <div className="border-border bg-surface-muted rounded-[12px] border py-2 pr-3 pl-2">
          <UserBadge />
        </div>
      </div>
    </div>
  );
}

/** The section's screens as tabs in the top bar; the active one is lit. Carries the period. */
function TopBarTabs({ pathname }: { pathname: string }) {
  const params = useSearchParams();
  const { session } = useSession();
  const { tabs, active } = sectionTabs(pathname, session?.role, session?.disabledSections ?? []);
  const keep = new URLSearchParams();
  for (const k of ['p', 'm', 'from', 'to', 'preset']) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();
  if (tabs.length === 0) return <span className="flex-1" />;
  return (
    <nav className="border-border flex min-w-0 flex-1 items-center gap-1 overflow-x-auto border-l pl-4">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={qs ? `${t.href}?${qs}` : t.href}
          aria-current={t.href === active ? 'page' : undefined}
          className={cn(
            'rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
            t.href === active
              ? 'bg-button-primary text-button-primary-fg'
              : 'text-fg-tertiary hover:text-fg hover:bg-surface-muted',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Brand mark: the lime square with a chart, as the LifeRM logo tile (ADR-062). */
function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'bg-button-primary text-button-primary-fg flex shrink-0 items-center justify-center rounded-[9px]',
        small ? 'size-7' : 'size-8',
      )}
    >
      <BarChart3 className={small ? 'size-4' : 'size-[18px]'} />
    </span>
  );
}

/** Standard page header used across screens (ТЗ §18). */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 sm:px-8">
      <div>
        {/* The menu already names the section; the title stays for screen readers and the tab. */}
        <h1 className="sr-only">{title}</h1>
        {subtitle ? <p className="text-fg-tertiary text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

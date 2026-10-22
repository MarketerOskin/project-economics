'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart3, Menu, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useSession } from '@/lib/client/session';
import { cn } from '@/lib/cn';
import { Nav, NavFooter, sectionLabel, sectionTabs } from './nav';
import { UserBadge } from './user-badge';
import { DemoRoleSwitch } from './demo-role-switch';
import { ThemeToggle } from './theme-toggle';
import { TableSort } from './table-sort';
import { BugReportButton } from '@/components/support/bug-report-button';
import { useBandEffect, useFrameFitted, useInBand } from '@/lib/client/viewport-band';
import { useSmoothScroll } from '@/components/motion/smooth-scroll';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // Inside Bitrix24 the iframe is as tall as the page, so `h-screen`/sticky pin the menu to
  // the whole page; keep the menu in the slice the user actually sees instead (ADR-059).
  const inBand = useInBand();
  // On a real portal the iframe is fitted to the screen (ADR-068) and the shell is pinned just
  // like outside Bitrix24. Only when it can't be fitted (stretched frame) does the menu follow
  // the visible slice — imperatively, since a React render per scroll step lagged and jerked.
  const fitted = useFrameFitted();
  const embedded = inBand && !fitted;
  const menuRef = React.useRef<HTMLDivElement>(null);
  useBandEffect((b) => {
    const el = menuRef.current;
    if (!el) return;
    if (!b || fitted) {
      el.style.cssText = '';
      return;
    }
    el.style.position = 'absolute';
    el.style.left = '16px';
    el.style.right = '0';
    el.style.top = '0';
    el.style.transform = `translate3d(0, ${b.top + 16}px, 0)`;
    el.style.height = `${b.height - 32}px`;
  });
  // On desktop outside Bitrix24 the shell is exactly one screen tall: the menu and the top bar
  // stay put and only the page area scrolls.
  const pinned = !embedded;
  React.useEffect(() => {
    if (fitted && menuRef.current) menuRef.current.style.cssText = '';
  }, [fitted]);
  const mainRef = React.useRef<HTMLElement>(null);
  const lenis = useSmoothScroll(mainRef, pinned);
  const pathname = usePathname();
  // A new page starts at the top, even if the old one was still gliding.
  React.useEffect(() => {
    lenis?.scrollTo(0, { immediate: true, force: true });
  }, [lenis, pathname]);

  // Nav links and the logo call this on click, so the drawer closes on navigation.
  const closeDrawer = React.useCallback(() => setDrawerOpen(false), []);

  // Inside the Bitrix24 iframe the glass drops its blur (globals.css): the portal page around
  // the app already costs the GPU enough.
  React.useEffect(() => {
    if (window.self !== window.top) document.documentElement.dataset.embedded = '1';
  }, []);

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
        'relative flex min-h-screen print:block print:h-auto print:min-h-0 print:overflow-visible print:bg-white',
        pinned && 'lg:h-screen lg:overflow-hidden',
      )}
    >
      {/* Mesh gradient behind the glass (ADR-065). */}
      <div aria-hidden className="mesh-bg print:hidden">
        <span />
      </div>

      {/* Backdrop — mobile only, only when the drawer is open. */}
      {drawerOpen ? (
        <div
          aria-hidden
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
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
        style={embedded ? { height: 'auto' } : undefined}
      >
        <div
          className="glass-chrome text-fg relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0b0b10]/75 shadow-[0_20px_50px_-20px_rgb(0_0_0/0.7),inset_0_1px_0_0_rgb(255_255_255/0.06)] in-data-[theme=light]:border-black/[0.06] in-data-[theme=light]:bg-white in-data-[theme=light]:shadow-[0_1px_2px_rgb(0_0_0/0.03),0_8px_24px_rgb(0_0_0/0.05)]"
          ref={menuRef}
        >
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Закрыть меню"
            className="text-fg-tertiary hover:text-fg absolute top-4 right-3 rounded-lg p-1.5 hover:bg-white/5 in-data-[theme=light]:hover:bg-black/5 lg:hidden"
          >
            <X className="size-4" />
          </button>

          <Link
            href="/"
            className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-4 in-data-[theme=light]:border-black/[0.06]"
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
                  <div
                    key={i}
                    className="h-[46px] animate-pulse rounded-2xl bg-white/5 in-data-[theme=light]:bg-black/5"
                  />
                ))}
              </div>
            ) : session ? (
              <Nav
                role={session.role}
                disabled={session.disabledSections ?? []}
                onNavigate={closeDrawer}
              />
            ) : null}

            <div className="mt-auto flex flex-col gap-2 border-t border-white/[0.07] pt-3 in-data-[theme=light]:border-black/[0.06]">
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
          'relative flex min-w-0 flex-1 flex-col print:block print:h-auto print:overflow-visible',
          pinned && 'lg:h-screen',
        )}
      >
        {/* Mobile top bar (< lg) */}
        <header className="glass-chrome sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--glass-border)] bg-[var(--glass-popover)] px-4 py-3 lg:hidden print:hidden">
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
          ref={mainRef}
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
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass-chrome flex h-[66px] items-center gap-4 rounded-[18px] border border-[var(--glass-border)] pr-2.5 pl-5 shadow-[var(--glass-shadow)] [background:var(--glass-bg)]"
      >
        <span aria-hidden className="relative flex size-2">
          <span className="bg-button-primary absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden" />
          <span className="bg-button-primary relative inline-flex size-2 rounded-full" />
        </span>
        <span className="shrink-0 truncate text-base font-bold">
          {label ?? 'Экономика проектов'}
        </span>
        <React.Suspense fallback={<span className="flex-1" />}>
          <TopBarTabs pathname={pathname} />
        </React.Suspense>
        <div className="rounded-[12px] border border-[var(--glass-border)] bg-white/[0.04] py-2 pr-3 pl-2 in-data-[theme=light]:bg-white">
          <UserBadge />
        </div>
      </motion.div>
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
    <nav className="border-border relative isolate flex min-w-0 flex-1 items-center gap-1 overflow-x-auto border-l pl-4">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={qs ? `${t.href}?${qs}` : t.href}
          aria-current={t.href === active ? 'page' : undefined}
          className={cn(
            'relative rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors',
            t.href === active
              ? 'text-button-primary-fg in-data-[theme=light]:text-white'
              : 'text-fg-tertiary hover:text-fg',
          )}
        >
          {/* The lit pill slides from tab to tab. */}
          {t.href === active ? (
            <motion.span
              layoutId="topbar-tab"
              aria-hidden
              className="bg-button-primary absolute inset-0 -z-10 rounded-full shadow-[0_6px_20px_-6px_rgb(214_255_63/0.55)] in-data-[theme=light]:bg-[#1d1d1f] in-data-[theme=light]:shadow-none"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          ) : null}
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
        'bg-button-primary text-button-primary-fg flex shrink-0 items-center justify-center rounded-[9px] shadow-[0_0_24px_-4px_rgb(214_255_63/0.6)] in-data-[theme=light]:shadow-none',
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

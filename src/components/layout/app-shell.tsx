'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useSession } from '@/lib/client/session';
import { cn } from '@/lib/cn';
import { Nav, NavFooter } from './nav';
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
    <div className="bg-bg flex min-h-screen print:block print:min-h-0 print:bg-white">
      {/* Backdrop — mobile only, only when the drawer is open. */}
      {drawerOpen ? (
        <div
          aria-hidden
          onClick={closeDrawer}
          className="fixed inset-0 z-40 bg-black/70 lg:hidden"
        />
      ) : null}

      {/* One sidebar: a static column on ≥ lg, a slide-in drawer below it. */}
      <aside
        className={cn(
          'border-border bg-bg fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r transition-transform duration-200 print:hidden',
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:transition-none',
          drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={band ? { height: 'auto' } : undefined}
      >
        <button
          type="button"
          onClick={closeDrawer}
          aria-label="Закрыть меню"
          className="text-fg-tertiary hover:bg-surface hover:text-fg absolute top-2 right-2 p-1.5 lg:hidden"
        >
          <X className="size-4" />
        </button>

        <div
          className="flex h-full flex-col gap-4 overflow-y-auto px-3 py-4"
          style={
            band
              ? { position: 'absolute', left: 0, right: 0, top: band.top, height: band.height }
              : undefined
          }
        >
          <Link href="/" className="flex items-center gap-3 px-2 py-1" onClick={closeDrawer}>
            <BrandMark className="size-10" />
            <div className="min-w-0">
              <div className="font-display text-accent text-[15px] leading-tight font-bold uppercase">
                Экономика проектов
              </div>
              <div className="tx-mark text-fg-tertiary mt-0.5 text-[10px]">Токсичная компания</div>
            </div>
          </Link>

          {loading ? (
            <div className="flex flex-col gap-1 px-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-surface/60 h-8 animate-pulse" />
              ))}
            </div>
          ) : session ? (
            <Nav
              role={session.role}
              disabled={session.disabledSections ?? []}
              onNavigate={closeDrawer}
            />
          ) : null}

          <div className="mt-auto flex flex-col gap-3">
            <DemoRoleSwitch />
            {session ? (
              <NavFooter
                role={session.role}
                disabled={session.disabledSections ?? []}
                onNavigate={closeDrawer}
              />
            ) : null}
            <ThemeToggle />
            <div className="px-1">
              <UserBadge />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (< lg) */}
        <header className="border-border bg-bg/90 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={drawerOpen}
            className="text-fg-secondary hover:bg-surface hover:text-fg -ml-1 p-1.5"
          >
            <Menu className="size-5" />
          </button>
          <BrandMark className="size-7" />
          <span className="font-display text-accent text-[15px] font-bold uppercase">
            Экономика проектов
          </span>
        </header>

        <main className="min-w-0 flex-1">
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

/** Mascot from toxick.ru — the app's brand mark. Plain <img>: tiny static asset. */
function BrandMark({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/brand-mascot.png"
      alt=""
      aria-hidden
      className={cn('shrink-0 object-contain', className)}
    />
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
    <header className="border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b px-4 py-4 sm:px-8">
      <div>
        {/* The menu already names the section; the title stays for screen readers and the tab. */}
        <h1 className="sr-only">{title}</h1>
        {subtitle ? <p className="text-fg-tertiary text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

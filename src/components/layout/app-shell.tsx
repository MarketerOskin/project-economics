'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useSession } from '@/lib/client/session';
import { cn } from '@/lib/cn';
import { Nav } from './nav';
import { UserBadge } from './user-badge';
import { DemoRoleSwitch } from './demo-role-switch';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close the mobile drawer on Escape.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const renderSidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4 px-3 py-4">
      <Link href="/" className="px-3 py-1" onClick={onNavigate}>
        <div className="text-[15px] font-semibold tracking-tight">Экономика проектов</div>
      </Link>

      {loading ? (
        <div className="flex flex-col gap-1 px-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-[10px] bg-surface/60" />
          ))}
        </div>
      ) : session ? (
        <Nav role={session.role} onNavigate={onNavigate} />
      ) : null}

      <div className="mt-auto flex flex-col gap-3">
        <DemoRoleSwitch />
        <div className="px-1">
          <UserBadge />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop sidebar (≥ lg) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-[#f0f0f2] lg:block">
        {renderSidebar()}
      </aside>

      {/* Mobile drawer (< lg) */}
      <div className={cn('lg:hidden', drawerOpen ? '' : 'pointer-events-none')}>
        <div
          aria-hidden
          onClick={() => setDrawerOpen(false)}
          className={cn(
            'fixed inset-0 z-40 bg-black/30 transition-opacity duration-200',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          )}
        />
        <aside
          className={cn(
            'fixed left-0 top-0 z-50 h-full w-64 border-r border-border bg-[#f0f0f2] shadow-xl transition-transform duration-200',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Закрыть меню"
            className="absolute right-2 top-2 rounded-[8px] p-1.5 text-fg-tertiary hover:bg-surface hover:text-fg"
          >
            <X className="size-4" />
          </button>
          {renderSidebar(() => setDrawerOpen(false))}
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar (< lg) */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-[#f0f0f2] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
            aria-expanded={drawerOpen}
            className="-ml-1 rounded-[8px] p-1.5 text-fg-secondary hover:bg-surface hover:text-fg"
          >
            <Menu className="size-5" />
          </button>
          <span className="text-[15px] font-semibold tracking-tight">Экономика проектов</span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
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
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-border px-4 py-5 sm:px-8 sm:py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

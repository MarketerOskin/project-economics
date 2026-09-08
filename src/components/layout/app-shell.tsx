'use client';

import Link from 'next/link';
import { useSession } from '@/lib/client/session';
import { Nav } from './nav';
import { UserBadge } from './user-badge';
import { DemoRoleSwitch } from './demo-role-switch';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-4 border-r border-border bg-[#f0f0f2] px-3 py-4">
        <Link href="/" className="px-3 py-1">
          <div className="text-[15px] font-semibold tracking-tight">Экономика проектов</div>
        </Link>

        {loading ? (
          <div className="flex flex-col gap-1 px-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-[10px] bg-surface/60" />
            ))}
          </div>
        ) : session ? (
          <Nav role={session.role} />
        ) : null}

        <div className="mt-auto flex flex-col gap-3">
          <DemoRoleSwitch />
          <div className="px-1">
            <UserBadge />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
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
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

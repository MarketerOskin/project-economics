'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { PortalsPanel } from './portals-panel';
import { LeadsPanel } from './leads-panel';

interface Overview {
  portalCount: number;
  proCount: number;
  newLeadCount: number;
}

export function OperatorDashboard({ operatorEmail }: { operatorEmail: string }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<'portals' | 'leads'>('portals');
  const [overview, setOverview] = React.useState<Overview | null>(null);

  const loadOverview = React.useCallback(() => {
    apiFetch<Overview>('/api/operator/overview')
      .then(setOverview)
      .catch(() => setOverview(null));
  }, []);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const logout = async () => {
    await apiFetch('/api/operator/logout', { method: 'POST' });
    router.push('/operator/login');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Экономика проектов — оператор</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {operatorEmail}
            {overview ? ` · ${overview.portalCount} портал(ов), ${overview.proCount} на Pro` : null}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={logout}>
          <LogOut className="size-3.5" />
          Выйти
        </Button>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('portals')}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm transition-colors',
            tab === 'portals' ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-secondary hover:text-fg',
          )}
        >
          Порталы
        </button>
        <button
          type="button"
          onClick={() => setTab('leads')}
          className={cn(
            '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
            tab === 'leads' ? 'border-accent font-medium text-fg' : 'border-transparent text-fg-secondary hover:text-fg',
          )}
        >
          Заявки на Pro
          {overview && overview.newLeadCount > 0 ? (
            <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-fg">
              {overview.newLeadCount}
            </span>
          ) : null}
        </button>
      </div>

      {tab === 'portals' ? <PortalsPanel /> : <LeadsPanel onChanged={loadOverview} />}
    </div>
  );
}

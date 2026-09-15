'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDateTime, toDateInputValue } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';

interface PortalRow {
  id: string;
  memberId: string;
  domain: string;
  isDemo: boolean;
  isActive: boolean;
  installedAt: string;
  plan: 'FREE' | 'PRO';
  effectivePlan: 'FREE' | 'PRO';
  planExpiresAt: string | null;
  planNote: string | null;
  projectCount: number;
  userCount: number;
}

interface GrantRow {
  id: string;
  plan: 'FREE' | 'PRO';
  expiresAt: string | null;
  note: string | null;
  operatorEmail: string;
  createdAt: string;
}

function PlanBadge({ plan, effective }: { plan: string; effective: string }) {
  const expired = plan === 'PRO' && effective === 'FREE';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        effective === 'PRO' ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-fg-tertiary',
      )}
    >
      {effective === 'PRO' ? 'Pro' : 'Free'}
      {expired ? ' (истёк)' : ''}
    </span>
  );
}

function PortalEditor({
  portal,
  onChanged,
}: {
  portal: PortalRow;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [plan, setPlan] = React.useState<'FREE' | 'PRO'>(portal.plan);
  const [expiresAt, setExpiresAt] = React.useState(portal.planExpiresAt ? toDateInputValue(new Date(portal.planExpiresAt)) : '');
  const [note, setNote] = React.useState(portal.planNote ?? '');
  const [saving, setSaving] = React.useState(false);
  const [history, setHistory] = React.useState<GrantRow[] | null>(null);

  const loadHistory = React.useCallback(() => {
    apiFetch<{ history: GrantRow[] }>(`/api/operator/portals/${portal.id}/plan`)
      .then((r) => setHistory(r.history))
      .catch(() => setHistory([]));
  }, [portal.id]);

  React.useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/operator/portals/${portal.id}/plan`, {
        method: 'PATCH',
        body: { plan, expiresAt: expiresAt || null, note: note || undefined },
      });
      toast(plan === 'PRO' ? 'Pro выдан' : 'Портал переведён на Free');
      loadHistory();
      onChanged();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 border-t border-border bg-surface-muted/40 px-4 py-4 sm:grid-cols-2">
      <div className="space-y-3">
        <Segmented
          value={plan}
          onChange={(v) => setPlan(v as 'FREE' | 'PRO')}
          options={[
            { value: 'FREE', label: 'Free' },
            { value: 'PRO', label: 'Pro' },
          ]}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg">Действует до (пусто — бессрочно)</label>
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} disabled={plan === 'FREE'} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg">Заметка</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например: оплатил на год, перевод от 12.03"
          />
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </div>

      <div>
        <div className="mb-1.5 text-sm font-medium text-fg">История выдач</div>
        {history === null ? (
          <p className="text-sm text-fg-tertiary">Загрузка…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-fg-tertiary">Изменений ещё не было</p>
        ) : (
          <ul className="max-h-52 space-y-2 overflow-y-auto text-sm">
            {history.map((g) => (
              <li key={g.id} className="rounded-[10px] border border-border bg-surface px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.plan === 'PRO' ? 'Pro' : 'Free'}</span>
                  <span className="text-xs text-fg-tertiary">{formatDateTime(new Date(g.createdAt))}</span>
                </div>
                <div className="mt-0.5 text-xs text-fg-tertiary">
                  {g.operatorEmail}
                  {g.expiresAt ? ` · до ${formatDateTime(new Date(g.expiresAt))}` : ''}
                </div>
                {g.note ? <div className="mt-1 text-xs text-fg-secondary">{g.note}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function PortalsDashboard({ operatorEmail }: { operatorEmail: string }) {
  const router = useRouter();
  const [portals, setPortals] = React.useState<PortalRow[] | null>(null);
  const [q, setQ] = React.useState('');
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const r = await apiFetch<{ portals: PortalRow[] }>(`/api/operator/portals${q ? `?q=${encodeURIComponent(q)}` : ''}`);
    setPortals(r.portals);
  }, [q]);

  React.useEffect(() => {
    // Fetch-on-mount: setState only happens after the awaited request resolves, not
    // synchronously during the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setPortals([]));
  }, [load]);

  const logout = async () => {
    await apiFetch('/api/operator/logout', { method: 'POST' });
    router.push('/operator/login');
    router.refresh();
  };

  const proCount = portals?.filter((p) => p.effectivePlan === 'PRO').length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Порталы</h1>
          <p className="mt-1 text-sm text-fg-secondary">
            {operatorEmail} · {portals?.length ?? '—'} портал(ов), {proCount} на Pro
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={logout}>
          <LogOut className="size-3.5" />
          Выйти
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по домену или member_id"
          className="pl-9"
        />
      </div>

      {portals === null ? (
        <p className="text-sm text-fg-tertiary">Загрузка…</p>
      ) : portals.length === 0 ? (
        <p className="text-sm text-fg-tertiary">Ничего не найдено</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-border">
          {portals.map((p) => (
            <div key={p.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left text-sm hover:bg-surface-muted"
              >
                <ChevronDown className={cn('size-4 shrink-0 text-fg-tertiary transition-transform', expanded === p.id && 'rotate-180')} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.isDemo ? 'Демо-портал' : p.domain}</span>
                    <PlanBadge plan={p.plan} effective={p.effectivePlan} />
                    {!p.isActive ? <span className="text-xs text-negative">отключено</span> : null}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-tertiary">
                    {p.memberId} · {p.projectCount} проект(ов) · {p.userCount} сотрудник(ов) · установлен {formatDateTime(new Date(p.installedAt))}
                  </div>
                </div>
              </button>
              {expanded === p.id ? <PortalEditor portal={p} onChanged={load} /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

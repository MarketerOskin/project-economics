'use client';

import * as React from 'react';
import { Mail } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';

type LeadStatus = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DECLINED';

interface LeadRow {
  id: string;
  portalId: string;
  portalDomain: string;
  portalIsDemo: boolean;
  requestedByName: string;
  contact: string;
  comment: string | null;
  status: LeadStatus;
  createdAt: string;
  handledAt: string | null;
  handledByOperator: string | null;
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Новая',
  CONTACTED: 'Связались',
  CONVERTED: 'Оплатил',
  DECLINED: 'Отказ',
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  NEW: 'bg-accent-soft text-accent',
  CONTACTED: 'bg-surface-muted text-fg-secondary',
  CONVERTED: 'bg-positive-soft text-positive',
  DECLINED: 'bg-surface-muted text-fg-tertiary',
};

function LeadCard({ lead, onChanged }: { lead: LeadRow; onChanged: () => void | Promise<void> }) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);

  const setStatus = async (status: LeadStatus) => {
    setBusy(status);
    try {
      await apiFetch(`/api/operator/leads/${lead.id}`, { method: 'PATCH', body: { status } });
      onChanged();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось обновить заявку', 'error');
    } finally {
      setBusy(null);
    }
  };

  const grantAndConvert = async () => {
    setBusy('grant');
    try {
      await apiFetch(`/api/operator/portals/${lead.portalId}/plan`, {
        method: 'PATCH',
        body: { plan: 'PRO', note: `Из заявки: ${lead.contact}${lead.comment ? ` — ${lead.comment}` : ''}` },
      });
      await apiFetch(`/api/operator/leads/${lead.id}`, { method: 'PATCH', body: { status: 'CONVERTED' } });
      toast('Pro выдан, заявка закрыта');
      onChanged();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось выдать Pro', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{lead.portalIsDemo ? 'Демо-портал' : lead.portalDomain}</span>
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[lead.status])}>
              {STATUS_LABEL[lead.status]}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-fg-secondary">{lead.requestedByName}</div>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-fg">
            <Mail className="size-3.5 text-fg-tertiary" />
            {lead.contact}
          </div>
          {lead.comment ? <p className="mt-1 text-sm text-fg-secondary">{lead.comment}</p> : null}
          <div className="mt-1.5 text-xs text-fg-tertiary">
            {formatDateTime(new Date(lead.createdAt))}
            {lead.handledByOperator ? ` · обработал ${lead.handledByOperator}` : ''}
          </div>
        </div>

        {lead.status === 'NEW' || lead.status === 'CONTACTED' ? (
          <div className="flex flex-wrap items-center gap-2">
            {lead.status === 'NEW' ? (
              <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => setStatus('CONTACTED')}>
                {busy === 'CONTACTED' ? '…' : 'Связался'}
              </Button>
            ) : null}
            <Button size="sm" disabled={busy !== null} onClick={grantAndConvert}>
              {busy === 'grant' ? 'Выдаю…' : 'Выдать Pro'}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setStatus('DECLINED')}>
              {busy === 'DECLINED' ? '…' : 'Отказ'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function LeadsPanel({ onChanged }: { onChanged?: () => void }) {
  const [leads, setLeads] = React.useState<LeadRow[] | null>(null);
  const [filter, setFilter] = React.useState<'OPEN' | 'ALL'>('OPEN');

  const load = React.useCallback(async () => {
    const r = await apiFetch<{ leads: LeadRow[] }>('/api/operator/leads');
    setLeads(r.leads);
    onChanged?.();
  }, [onChanged]);

  React.useEffect(() => {
    // Fetch-on-mount: setState only happens after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load().catch(() => setLeads([]));
  }, [load]);

  const shown = leads?.filter((l) => filter === 'ALL' || l.status === 'NEW' || l.status === 'CONTACTED') ?? [];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'OPEN', label: 'В работе' },
            { value: 'ALL', label: 'Все' },
          ]}
        />
        <span className="text-sm text-fg-tertiary">{shown.length}</span>
      </div>

      {leads === null ? (
        <p className="text-sm text-fg-tertiary">Загрузка…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-fg-tertiary">
          {filter === 'OPEN' ? 'Открытых заявок нет' : 'Заявок ещё не было'}
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

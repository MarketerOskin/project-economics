'use client';

import * as React from 'react';
import { Search, Check } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/ui/segmented';

export interface CrmSelection {
  entityTypeId: number;
  id: string;
  title: string;
  clientName: string | null;
}

interface Item {
  id: string;
  title: string;
  clientName: string | null;
  entityTypeId: number;
}

export function CrmImport({
  value,
  onChange,
}: {
  value: CrmSelection | null;
  onChange: (v: CrmSelection | null) => void;
}) {
  const [entityTypeId, setEntityTypeId] = React.useState(2);
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    // Synchronising the list with an external system (Bitrix CRM) when the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch<{ items: Item[] }>(`/api/crm?entityTypeId=${entityTypeId}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [entityTypeId, q]);

  return (
    <div className="space-y-3">
      <Segmented
        value={String(entityTypeId)}
        onChange={(v) => setEntityTypeId(Number(v))}
        options={[
          { value: '2', label: 'Сделки' },
          { value: '4', label: 'Компании' },
        ]}
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию"
          className="h-9 w-full rounded-[10px] border border-border bg-surface pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </div>

      {error ? (
        <p className="rounded-[10px] bg-negative-soft px-3 py-2 text-sm text-negative">{error}</p>
      ) : null}

      <div className="max-h-64 space-y-1 overflow-y-auto rounded-[12px] border border-border p-1">
        {loading ? (
          <p className="px-3 py-6 text-center text-sm text-fg-tertiary">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-fg-tertiary">Ничего не найдено</p>
        ) : (
          items.map((it) => {
            const selected = value?.id === it.id && value?.entityTypeId === it.entityTypeId;
            return (
              <button
                key={`${it.entityTypeId}-${it.id}`}
                type="button"
                onClick={() =>
                  onChange(
                    selected
                      ? null
                      : { entityTypeId: it.entityTypeId, id: it.id, title: it.title, clientName: it.clientName },
                  )
                }
                className={cn(
                  'flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm hover:bg-surface-muted',
                  selected && 'bg-accent-soft',
                )}
              >
                <span>
                  {it.title}
                  {it.clientName && it.clientName !== it.title ? (
                    <span className="block text-xs text-fg-tertiary">{it.clientName}</span>
                  ) : null}
                </span>
                {selected ? <Check className="size-4 text-accent" /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

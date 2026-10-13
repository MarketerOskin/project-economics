'use client';

import * as React from 'react';
import { Search, Check } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BitrixGroupImport, type BitrixGroupSelection } from './bitrix-group-import';

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

interface Source {
  entityTypeId: number;
  label: string;
}

/** Tab for Bitrix24's native "Проекты" module — not a CRM entity type (ADR-031). */
const GROUPS_TAB = 'groups';
/** One tab for all smart processes; the process itself is picked from a list inside it. */
const SMART_TAB = 'smart';
/** Built-in CRM types that come before "Проекты"; smart processes follow it. */
const BUILT_IN_TYPES = new Set([2, 4]); // Сделка, Компания

/**
 * One picker for everything a project can be imported from in Bitrix24: CRM deals,
 * companies, the "Проекты" module and every smart process on the portal (ADR-033, ADR-036).
 */
export function CrmImport({
  value,
  onChange,
  group,
  onGroupChange,
}: {
  value: CrmSelection | null;
  onChange: (v: CrmSelection | null) => void;
  group: BitrixGroupSelection | null;
  onGroupChange: (v: BitrixGroupSelection | null) => void;
}) {
  const [sources, setSources] = React.useState<Source[] | null>(null);
  const [tab, setTab] = React.useState<string | null>(null);
  const [smartType, setSmartType] = React.useState<string | null>(null);
  const entityTypeId =
    tab === null || tab === GROUPS_TAB
      ? null
      : tab === SMART_TAB
        ? smartType
          ? Number(smartType)
          : null
        : Number(tab);
  const [q, setQ] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Deal + Company plus every Smart Process the portal has (ADR-036) — fetch what's really
  // there instead of assuming entity types.
  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ sources: Source[] }>('/api/crm/available-sources')
      .then((r) => {
        if (cancelled) return;
        setSources(r.sources);
        setTab(
          (current) =>
            current ??
            String(
              r.sources.find((s) => BUILT_IN_TYPES.has(s.entityTypeId))?.entityTypeId ?? GROUPS_TAB,
            ),
        );
      })
      .catch(
        (e) => !cancelled && setError(e instanceof Error ? e.message : 'Не удалось загрузить'),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (entityTypeId === null) return;
    let cancelled = false;
    // Synchronising the list with an external system (Bitrix CRM) when the filter changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    apiFetch<{ items: Item[] }>(
      `/api/crm?entityTypeId=${entityTypeId}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    )
      .then((r) => !cancelled && setItems(r.items))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [entityTypeId, q]);

  const builtIn = sources?.filter((s) => BUILT_IN_TYPES.has(s.entityTypeId)) ?? [];
  const smart = sources?.filter((s) => !BUILT_IN_TYPES.has(s.entityTypeId)) ?? [];
  const tabs = sources
    ? [
        ...builtIn.map((s) => ({ value: String(s.entityTypeId), label: s.label })),
        { value: GROUPS_TAB, label: 'Проекты' },
        ...(smart.length > 0 ? [{ value: SMART_TAB, label: 'Смарт-процессы' }] : []),
      ]
    : [];

  return (
    <div className="space-y-3">
      {tabs.length > 1 && tab !== null ? (
        <div className="overflow-x-auto">
          <Segmented value={tab} onChange={setTab} options={tabs} />
        </div>
      ) : null}
      {tab === SMART_TAB ? (
        <Select value={smartType ?? undefined} onValueChange={setSmartType}>
          <SelectTrigger aria-label="Смарт-процесс">
            <SelectValue placeholder="Выберите смарт-процесс" />
          </SelectTrigger>
          <SelectContent className="w-[var(--radix-select-trigger-width)] overflow-y-auto">
            {smart.map((s) => (
              <SelectItem key={s.entityTypeId} value={String(s.entityTypeId)}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {tab === GROUPS_TAB ? (
        <BitrixGroupImport value={group} onChange={onGroupChange} />
      ) : tab === SMART_TAB && smartType === null ? null : (
        <CrmList
          q={q}
          setQ={setQ}
          error={error}
          loading={loading}
          items={items}
          value={value}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function CrmList({
  q,
  setQ,
  error,
  loading,
  items,
  value,
  onChange,
}: {
  q: string;
  setQ: (q: string) => void;
  error: string | null;
  loading: boolean;
  items: Item[];
  value: CrmSelection | null;
  onChange: (v: CrmSelection | null) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-fg-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по названию"
          className="border-border bg-surface focus-visible:ring-accent/30 h-9 w-full border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
        />
      </div>

      {error ? <p className="bg-negative-soft text-negative px-3 py-2 text-sm">{error}</p> : null}

      <div className="border-border max-h-64 space-y-1 overflow-y-auto border p-1">
        {loading ? (
          <p className="text-fg-tertiary px-3 py-6 text-center text-sm">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-fg-tertiary px-3 py-6 text-center text-sm">Ничего не найдено</p>
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
                      : {
                          entityTypeId: it.entityTypeId,
                          id: it.id,
                          title: it.title,
                          clientName: it.clientName,
                        },
                  )
                }
                className={cn(
                  'hover:bg-surface-muted flex w-full items-center justify-between px-3 py-2 text-left text-sm',
                  selected && 'bg-accent-soft',
                )}
              >
                <span>
                  {it.title}
                  {it.clientName && it.clientName !== it.title ? (
                    <span className="text-fg-tertiary block text-xs">{it.clientName}</span>
                  ) : null}
                </span>
                {selected ? <Check className="text-accent size-4" /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

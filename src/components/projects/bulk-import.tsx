'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Field, Input } from '@/components/ui/field';
import { parseProjectList } from '@/lib/project-list';
import { MemberSelect } from './member-select';
import type { StreamKind } from '@prisma/client';
import { STREAM_KINDS, STREAM_KIND_LABELS } from '@/lib/streams';

/** What one new project is made from. */
type Draft =
  | {
      key: string;
      title: string;
      source: 'BITRIX_CRM';
      crmEntityTypeId: number;
      crmEntityId: string;
      clientName: string | null;
    }
  | { key: string; title: string; source: 'BITRIX_PROJECT'; bitrixGroupId: string }
  | { key: string; title: string; source: 'MANUAL'; clientName: string | null };

interface Source {
  entityTypeId: number;
  label: string;
}

interface Row {
  key: string;
  title: string;
  hint: string | null;
  draft: Draft;
}

const GROUPS = 'groups';

/** What every project created in one run gets, unless its own row says otherwise. */
interface Defaults {
  status: 'ACTIVE' | 'COMPLETED';
  clientName: string;
  startDate: string;
  endDate: string;
  memberIds: string[];
  hoursLimit: string;
  monthlyFee: string;
  hourRate: string;
  /** A direction to add to every project (ADR-052); '' — none. */
  kind: StreamKind | '';
}

const EMPTY_DEFAULTS: Defaults = {
  status: 'ACTIVE',
  clientName: '',
  startDate: '',
  endDate: '',
  memberIds: [],
  kind: '',
  hoursLimit: '',
  monthlyFee: '',
  hourRate: '',
};

function DefaultsForm({ value, onChange }: { value: Defaults; onChange: (v: Defaults) => void }) {
  const set = <K extends keyof Defaults>(k: K, v: Defaults[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="border-border bg-surface flex flex-col gap-4 border p-4">
      <div>
        <h2 className="tx-mark text-accent">Данные по умолчанию</h2>
        <p className="text-fg-tertiary mt-1 text-xs">
          Применятся ко всем проектам, которые создаются сейчас. Пустые поля не заполняются. Клиент
          из строки списка или из Битрикс24 важнее клиента по умолчанию.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Статус">
          <Segmented
            value={value.status}
            onChange={(v) => set('status', v)}
            options={[
              { value: 'ACTIVE', label: 'Активный' },
              { value: 'COMPLETED', label: 'Завершён' },
            ]}
          />
        </Field>
        <Field label="Клиент">
          <Input
            value={value.clientName}
            onChange={(e) => set('clientName', e.target.value)}
            placeholder="Необязательно"
          />
        </Field>
        <Field label="Дата начала">
          <Input
            type="date"
            value={value.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
        </Field>
        <Field label="Дата окончания">
          <Input
            type="date"
            value={value.endDate}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Команда">
        <MemberSelect value={value.memberIds} onChange={(ids) => set('memberIds', ids)} />
      </Field>
      <Field label="Направление">
        <Segmented
          value={value.kind || 'NONE'}
          onChange={(v) => set('kind', v === 'NONE' ? '' : (v as StreamKind))}
          options={[
            { value: 'NONE', label: 'Без направления' },
            ...STREAM_KINDS.map((k) => ({ value: k, label: STREAM_KIND_LABELS[k] })),
          ]}
          className="flex-wrap"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Пакет, часов в месяц">
          <Input
            inputMode="decimal"
            value={value.hoursLimit}
            onChange={(e) => set('hoursLimit', e.target.value)}
          />
        </Field>
        <Field label="Абонентская плата">
          <Input
            inputMode="decimal"
            value={value.monthlyFee}
            onChange={(e) => set('monthlyFee', e.target.value)}
          />
        </Field>
        <Field label="Цена часа">
          <Input
            inputMode="decimal"
            value={value.hourRate}
            onChange={(e) => set('hourRate', e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

function FromBitrix({
  linked,
  selected,
  setSelected,
}: {
  linked: Set<string>;
  selected: Map<string, Draft>;
  setSelected: React.Dispatch<React.SetStateAction<Map<string, Draft>>>;
}) {
  const [sources, setSources] = React.useState<Source[] | null>(null);
  const [source, setSource] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [rows, setRows] = React.useState<Row[]>([]);
  const [next, setNext] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<{ sources: Source[] }>('/api/crm/available-sources')
      .then((r) => setSources(r.sources))
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить разделы'));
  }, []);

  const load = React.useCallback(
    async (start: number) => {
      if (!source) return;
      setLoading(true);
      setError(null);
      try {
        if (source === GROUPS) {
          const r = await apiFetch<{ items: Array<{ id: string; title: string }> }>(
            `/api/bitrix-groups${q ? `?q=${encodeURIComponent(q)}` : ''}`,
          );
          setRows(
            r.items.map((g) => ({
              key: `group:${g.id}`,
              title: g.title,
              hint: null,
              draft: {
                key: `group:${g.id}`,
                title: g.title,
                source: 'BITRIX_PROJECT',
                bitrixGroupId: g.id,
              },
            })),
          );
          setNext(null);
        } else {
          const entityTypeId = Number(source);
          const r = await apiFetch<{
            items: Array<{ id: string; title: string; clientName: string | null }>;
            next: number | null;
          }>(
            `/api/crm?entityTypeId=${entityTypeId}&start=${start}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
          );
          const page = r.items.map((i) => ({
            key: `crm:${entityTypeId}:${i.id}`,
            title: i.title,
            hint: i.clientName && i.clientName !== i.title ? i.clientName : null,
            draft: {
              key: `crm:${entityTypeId}:${i.id}`,
              title: i.title,
              source: 'BITRIX_CRM' as const,
              crmEntityTypeId: entityTypeId,
              crmEntityId: i.id,
              clientName: i.clientName,
            },
          }));
          setRows((prev) => (start === 0 ? page : [...prev, ...page]));
          setNext(r.next);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить');
      } finally {
        setLoading(false);
      }
    },
    [source, q],
  );

  React.useEffect(() => {
    // Reload the list when the section or the search changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0);
  }, [load]);

  const fresh = rows.filter((r) => !linked.has(r.key));
  const allSelected = fresh.length > 0 && fresh.every((r) => selected.has(r.key));
  const toggle = (r: Row) =>
    setSelected((prev) => {
      const n = new Map(prev);
      if (n.has(r.key)) n.delete(r.key);
      else n.set(r.key, r.draft);
      return n;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Map(prev);
      for (const r of fresh) {
        if (allSelected) n.delete(r.key);
        else n.set(r.key, r.draft);
      }
      return n;
    });

  return (
    <div className="flex flex-col gap-3">
      <Select value={source ?? undefined} onValueChange={(v) => setSource(v)}>
        <SelectTrigger aria-label="Раздел Битрикс24">
          <SelectValue placeholder={sources ? 'Выберите раздел Битрикс24' : 'Загружаю разделы…'} />
        </SelectTrigger>
        <SelectContent className="w-[var(--radix-select-trigger-width)] overflow-y-auto">
          {(sources ?? []).slice(0, 2).map((s) => (
            <SelectItem key={s.entityTypeId} value={String(s.entityTypeId)}>
              {s.label}
            </SelectItem>
          ))}
          <SelectItem value={GROUPS}>Проекты (группы)</SelectItem>
          {(sources ?? []).slice(2).map((s) => (
            <SelectItem key={s.entityTypeId} value={String(s.entityTypeId)}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {source ? (
        <>
          <div className="relative">
            <Search className="text-fg-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию"
              className="border-border bg-surface focus-visible:ring-accent/30 h-9 w-full border pr-3 pl-9 text-sm outline-none focus-visible:ring-2"
            />
          </div>
          {error ? (
            <p className="bg-negative-soft text-negative px-3 py-2 text-sm">{error}</p>
          ) : null}
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={toggleAll}
              disabled={fresh.length === 0}
              className="text-accent hover:underline disabled:opacity-50"
            >
              {allSelected ? 'Снять выбор' : `Выбрать все (${fresh.length})`}
            </button>
            <span className="text-fg-tertiary">
              Уже есть в приложении: {rows.length - fresh.length}
            </span>
          </div>
          <div className="border-border max-h-[28rem] overflow-y-auto border">
            {rows.map((r) => {
              const exists = linked.has(r.key);
              const on = selected.has(r.key);
              return (
                <button
                  key={r.key}
                  type="button"
                  disabled={exists}
                  onClick={() => toggle(r)}
                  className={cn(
                    'border-border hover:bg-surface-muted flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-0 disabled:cursor-default disabled:opacity-50',
                    on && 'bg-accent-soft',
                  )}
                >
                  <span
                    className={cn(
                      'border-border flex size-4 shrink-0 items-center justify-center border',
                      on && 'border-accent bg-accent text-accent-fg',
                    )}
                  >
                    {on ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    {r.title}
                    {r.hint ? (
                      <span className="text-fg-tertiary block text-xs">{r.hint}</span>
                    ) : null}
                  </span>
                  {exists ? <span className="text-fg-tertiary text-xs">уже есть</span> : null}
                </button>
              );
            })}
            {loading ? (
              <p className="text-fg-tertiary px-3 py-4 text-center text-sm">Загрузка…</p>
            ) : null}
            {!loading && rows.length === 0 ? (
              <p className="text-fg-tertiary px-3 py-4 text-center text-sm">Ничего не найдено</p>
            ) : null}
          </div>
          {next !== null && !loading ? (
            <Button variant="secondary" size="sm" onClick={() => load(next)}>
              Показать ещё
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Many projects at once: picked from a Bitrix24 section or typed as a list (ADR-043). */
export function BulkImport() {
  const [mode, setMode] = React.useState<'bitrix' | 'list'>('bitrix');
  const [linked, setLinked] = React.useState<Set<string>>(new Set());
  const [selected, setSelected] = React.useState<Map<string, Draft>>(new Map());
  const [text, setText] = React.useState('');
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = React.useState<Array<{ title: string; error: string }>>([]);
  const [created, setCreated] = React.useState(0);
  const [defaults, setDefaults] = React.useState<Defaults>(EMPTY_DEFAULTS);

  React.useEffect(() => {
    apiFetch<{ keys: string[] }>('/api/projects/linked-sources')
      .then((r) => setLinked(new Set(r.keys)))
      .catch(() => undefined);
  }, []);

  const listed = parseProjectList(text);
  const drafts: Draft[] =
    mode === 'bitrix'
      ? [...selected.values()]
      : listed.map((p, i) => ({
          key: `manual:${i}`,
          title: p.name,
          source: 'MANUAL',
          clientName: p.clientName,
        }));

  const run = async () => {
    setFailures([]);
    setCreated(0);
    setProgress({ done: 0, total: drafts.length });
    const done = new Set<string>();
    const errors: Array<{ title: string; error: string }> = [];
    let ok = 0;
    const hasPackage = Boolean(defaults.hoursLimit || defaults.monthlyFee || defaults.hourRate);
    for (const [i, d] of drafts.entries()) {
      const base =
        d.source === 'BITRIX_CRM'
          ? {
              name: d.title,
              source: d.source,
              crmEntityTypeId: d.crmEntityTypeId,
              crmEntityId: d.crmEntityId,
            }
          : d.source === 'BITRIX_PROJECT'
            ? { name: d.title, source: d.source, bitrixGroupId: d.bitrixGroupId }
            : { name: d.title, source: d.source, clientName: d.clientName ?? undefined };
      const body = {
        status: defaults.status,
        startDate: defaults.startDate || undefined,
        endDate: defaults.endDate || undefined,
        memberIds: defaults.memberIds,
        ...(defaults.clientName.trim() ? { clientName: defaults.clientName.trim() } : {}),
        ...base,
      };
      if ('clientName' in base && !base.clientName && defaults.clientName.trim())
        body.clientName = defaults.clientName.trim();
      try {
        const { id } = await apiFetch<{ id: string }>('/api/projects', { method: 'POST', body });
        if (defaults.kind) {
          // The direction carries the team and the payment terms (ADR-052).
          await apiFetch(`/api/projects/${id}/streams`, {
            method: 'POST',
            body: {
              kind: defaults.kind,
              status: defaults.status,
              startDate: defaults.startDate || null,
              endDate: defaults.endDate || null,
              memberIds: defaults.memberIds,
              hoursLimit: defaults.hoursLimit || null,
              monthlyFee: defaults.monthlyFee || null,
              hourRate: defaults.hourRate || null,
            },
          }).catch((e) => {
            errors.push({
              title: d.title,
              error: `создан, но направление не добавлено: ${e instanceof ApiError ? e.message : 'ошибка'}`,
            });
          });
        }
        if (hasPackage && defaults.kind !== 'DEVELOPMENT' && defaults.kind !== 'IMPLEMENTATION') {
          await apiFetch(`/api/projects/${id}/support-package`, {
            method: 'PATCH',
            body: {
              hoursLimit: defaults.hoursLimit || null,
              monthlyFee: defaults.monthlyFee || null,
              hourRate: defaults.hourRate || null,
            },
          }).catch((e) => {
            errors.push({
              title: d.title,
              error: `создан, но пакет часов не задан: ${e instanceof ApiError ? e.message : 'ошибка'}`,
            });
          });
        }
        ok++;
        done.add(d.key);
      } catch (e) {
        errors.push({
          title: d.title,
          error: e instanceof ApiError ? e.message : 'Не удалось создать',
        });
      }
      setProgress({ done: i + 1, total: drafts.length });
    }
    setCreated(ok);
    setFailures(errors);
    setLinked((prev) => new Set([...prev, ...done]));
    setSelected((prev) => new Map([...prev].filter(([k]) => !done.has(k))));
    if (mode === 'list' && errors.length === 0) setText('');
    setProgress(null);
  };

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Segmented
        value={mode}
        onChange={(v) => setMode(v as 'bitrix' | 'list')}
        options={[
          { value: 'bitrix', label: 'Из Битрикс24' },
          { value: 'list', label: 'Списком' },
        ]}
      />

      {mode === 'bitrix' ? (
        <FromBitrix linked={linked} selected={selected} setSelected={setSelected} />
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={'Внедрение CRM; ООО «Альфа»\nПоддержка сайта; ИП Иванов\nАудит портала'}
            className="border-border bg-surface focus-visible:ring-accent/30 w-full border px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2"
          />
          <p className="text-fg-tertiary text-xs">
            Один проект в строке. Клиента можно указать после точки с запятой или табуляции, так что
            строки можно вставить прямо из Excel.
          </p>
        </div>
      )}

      <DefaultsForm value={defaults} onChange={setDefaults} />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={drafts.length === 0 || progress !== null}>
          {progress
            ? `Создаю ${progress.done} из ${progress.total}…`
            : `Создать проекты: ${drafts.length}`}
        </Button>
        {created > 0 && !progress ? (
          <span className="text-positive text-sm">
            Создано: {created}.{' '}
            <Link href="/projects" className="underline underline-offset-2">
              К проектам
            </Link>
          </span>
        ) : null}
      </div>

      {failures.length > 0 ? (
        <div className="border-negative/40 bg-negative-soft border px-4 py-3 text-sm">
          <p className="text-negative font-medium">Не создано: {failures.length}</p>
          <ul className="text-fg-secondary mt-1 list-disc pl-5">
            {failures.map((f, i) => (
              <li key={i}>
                {f.title}: {f.error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

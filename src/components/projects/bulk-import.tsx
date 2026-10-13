'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, Search } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parseProjectList } from '@/lib/project-list';

/** What one new project is made from. */
type Draft =
  | { key: string; title: string; source: 'BITRIX_CRM'; crmEntityTypeId: number; crmEntityId: string; clientName: string | null }
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

function FromBitrix({ linked, selected, setSelected }: { linked: Set<string>; selected: Map<string, Draft>; setSelected: React.Dispatch<React.SetStateAction<Map<string, Draft>>> }) {
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
          const r = await apiFetch<{ items: Array<{ id: string; title: string }> }>(`/api/bitrix-groups${q ? `?q=${encodeURIComponent(q)}` : ''}`);
          setRows(
            r.items.map((g) => ({
              key: `group:${g.id}`,
              title: g.title,
              hint: null,
              draft: { key: `group:${g.id}`, title: g.title, source: 'BITRIX_PROJECT', bitrixGroupId: g.id },
            })),
          );
          setNext(null);
        } else {
          const entityTypeId = Number(source);
          const r = await apiFetch<{ items: Array<{ id: string; title: string; clientName: string | null }>; next: number | null }>(
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
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по названию"
              className="h-9 w-full border border-border bg-surface pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
            />
          </div>
          {error ? <p className="bg-negative-soft px-3 py-2 text-sm text-negative">{error}</p> : null}
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={toggleAll} disabled={fresh.length === 0} className="text-accent hover:underline disabled:opacity-50">
              {allSelected ? 'Снять выбор' : `Выбрать все (${fresh.length})`}
            </button>
            <span className="text-fg-tertiary">Уже есть в приложении: {rows.length - fresh.length}</span>
          </div>
          <div className="max-h-[28rem] overflow-y-auto border border-border">
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
                    'flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-muted disabled:cursor-default disabled:opacity-50',
                    on && 'bg-accent-soft',
                  )}
                >
                  <span className={cn('flex size-4 shrink-0 items-center justify-center border border-border', on && 'border-accent bg-accent text-accent-fg')}>
                    {on ? <Check className="size-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    {r.title}
                    {r.hint ? <span className="block text-xs text-fg-tertiary">{r.hint}</span> : null}
                  </span>
                  {exists ? <span className="text-xs text-fg-tertiary">уже есть</span> : null}
                </button>
              );
            })}
            {loading ? <p className="px-3 py-4 text-center text-sm text-fg-tertiary">Загрузка…</p> : null}
            {!loading && rows.length === 0 ? <p className="px-3 py-4 text-center text-sm text-fg-tertiary">Ничего не найдено</p> : null}
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

  React.useEffect(() => {
    apiFetch<{ keys: string[] }>('/api/projects/linked-sources')
      .then((r) => setLinked(new Set(r.keys)))
      .catch(() => undefined);
  }, []);

  const listed = parseProjectList(text);
  const drafts: Draft[] =
    mode === 'bitrix'
      ? [...selected.values()]
      : listed.map((p, i) => ({ key: `manual:${i}`, title: p.name, source: 'MANUAL', clientName: p.clientName }));

  const run = async () => {
    setFailures([]);
    setCreated(0);
    setProgress({ done: 0, total: drafts.length });
    const done = new Set<string>();
    const errors: Array<{ title: string; error: string }> = [];
    let ok = 0;
    for (const [i, d] of drafts.entries()) {
      const body =
        d.source === 'BITRIX_CRM'
          ? { name: d.title, source: d.source, crmEntityTypeId: d.crmEntityTypeId, crmEntityId: d.crmEntityId }
          : d.source === 'BITRIX_PROJECT'
            ? { name: d.title, source: d.source, bitrixGroupId: d.bitrixGroupId }
            : { name: d.title, source: d.source, clientName: d.clientName ?? undefined };
      try {
        await apiFetch('/api/projects', { method: 'POST', body });
        ok++;
        done.add(d.key);
      } catch (e) {
        errors.push({ title: d.title, error: e instanceof ApiError ? e.message : 'Не удалось создать' });
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
            className="w-full border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <p className="text-xs text-fg-tertiary">
            Один проект в строке. Клиента можно указать после точки с запятой или табуляции, так что строки можно
            вставить прямо из Excel.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={drafts.length === 0 || progress !== null}>
          {progress ? `Создаю ${progress.done} из ${progress.total}…` : `Создать проекты: ${drafts.length}`}
        </Button>
        {created > 0 && !progress ? (
          <span className="text-sm text-positive">
            Создано: {created}.{' '}
            <Link href="/projects" className="underline underline-offset-2">
              К проектам
            </Link>
          </span>
        ) : null}
      </div>

      {failures.length > 0 ? (
        <div className="border border-negative/40 bg-negative-soft px-4 py-3 text-sm">
          <p className="font-medium text-negative">Не создано: {failures.length}</p>
          <ul className="mt-1 list-disc pl-5 text-fg-secondary">
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

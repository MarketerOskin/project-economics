'use client';

import * as React from 'react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { OUTCOME_LABELS, type StageOutcome } from '@/domain/crm/stages';
import type { StageSection } from '@/server/services/stage-rules';

const OPTIONS = (['PROCESS', 'CLOSED', 'SUCCESS', 'CANCELLED'] as StageOutcome[]).map((v) => ({
  value: v,
  label: OUTCOME_LABELS[v],
}));

/**
 * Per CRM section: how each stage of each funnel counts (ADR-051). Starts from what Bitrix24
 * says; a stage the portal changes is marked, and «Как в Битрикс24» drops the change.
 */
function SectionCard({ section }: { section: StageSection }) {
  const { toast } = useToast();
  const initial = React.useMemo(() => {
    const m: Record<string, StageOutcome> = {};
    for (const f of section.funnels) for (const s of f.stages) m[s.id] = s.outcome ?? s.bitrix;
    return m;
  }, [section]);
  const [values, setValues] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const bitrix = React.useMemo(() => {
    const m: Record<string, StageOutcome> = {};
    for (const f of section.funnels) for (const s of f.stages) m[s.id] = s.bitrix;
    return m;
  }, [section]);
  const dirty = Object.keys(values).some((k) => values[k] !== initial[k]);

  const save = async () => {
    setSaving(true);
    try {
      const rules = Object.entries(values)
        .filter(([id, v]) => v !== bitrix[id])
        .map(([stageId, outcome]) => ({ stageId, outcome }));
      await apiFetch('/api/crm/stage-rules', {
        method: 'PUT',
        body: { entityTypeId: section.entityTypeId, rules },
      });
      toast(`Стадии «${section.title}» сохранены`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-border bg-surface border">
      <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-fg font-semibold">{section.title}</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setValues({ ...bitrix })}
            disabled={saving}
          >
            Как в Битрикс24
          </Button>
          <Button type="button" size="sm" onClick={save} disabled={saving || !dirty}>
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </Button>
        </div>
      </header>
      {section.error ? (
        <p className="text-negative px-4 py-3 text-sm">
          Не удалось прочитать стадии: {section.error}
        </p>
      ) : null}
      {section.funnels.map((f) => (
        <div key={String(f.id)} className="border-border border-b last:border-0">
          {section.funnels.length > 1 || f.id !== null ? (
            <div className="text-fg-tertiary px-4 pt-3 font-mono text-[11px] tracking-[0.06em] uppercase">
              Воронка «{f.name}»
            </div>
          ) : null}
          <ul className="divide-border divide-y">
            {f.stages.map((s) => {
              const v = values[s.id] ?? s.bitrix;
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0">
                    <span className="text-fg">{s.name}</span>
                    <span
                      className={cn(
                        'ml-2 text-xs',
                        v === s.bitrix ? 'text-fg-tertiary' : 'text-accent',
                      )}
                    >
                      {v === s.bitrix
                        ? `как в Битрикс24`
                        : `в Битрикс24 — «${OUTCOME_LABELS[s.bitrix]}»`}
                    </span>
                  </span>
                  <Segmented
                    value={v}
                    onChange={(nv) => setValues((x) => ({ ...x, [s.id]: nv }))}
                    options={OPTIONS}
                    className="shrink-0 self-start sm:self-auto"
                  />
                </li>
              );
            })}
            {f.stages.length === 0 ? (
              <li className="text-fg-tertiary px-4 py-2.5 text-sm">Стадий нет</li>
            ) : null}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function StageRulesManager() {
  const [sections, setSections] = React.useState<StageSection[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch<{ sections: StageSection[] }>('/api/crm/stage-rules')
      .then((r) => setSections(r.sections))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить стадии'),
      );
  }, []);

  if (error) return <p className="text-negative text-sm">{error}</p>;
  if (!sections) return <p className="text-fg-tertiary text-sm">Загружаю стадии из Битрикс24…</p>;
  if (sections.length === 0) return <p className="text-fg-tertiary text-sm">Разделов CRM нет.</p>;
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => (
        <SectionCard key={s.entityTypeId} section={s} />
      ))}
    </div>
  );
}

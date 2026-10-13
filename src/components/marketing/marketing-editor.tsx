'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatRubStr } from '@/lib/format';
import { m } from '@/domain/finance/money';
import { reversePlan } from '@/domain/finance/marketing';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MarketingReport } from '@/server/services/marketing';

type Tab = 'spend' | 'plan' | 'qualified';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const intOrNull = (s: string) =>
  s.trim() === '' ? null : Math.max(0, Math.round(Number(s.replace(/\s/g, ''))));

function SpendForm({
  report,
  today,
  onSaved,
}: {
  report: MarketingReport;
  today: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [sourceId, setSourceId] = React.useState(
    report.channels.find((c) => c.sourceId)?.sourceId ?? report.sourceOptions[0]?.id ?? '',
  );
  const [date, setDate] = React.useState(today);
  const [kind, setKind] = React.useState<'SPENT' | 'PAID'>('SPENT');
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/marketing/spend', {
        method: 'POST',
        body: {
          sourceId,
          channel: report.sourceOptions.find((s) => s.id === sourceId)?.name,
          date,
          kind,
          amount,
          note: note || undefined,
        },
      });
      toast(kind === 'SPENT' ? 'Расход добавлен' : 'Оплата добавлена');
      setAmount('');
      setNote('');
      onSaved();
    } catch (e) {
      toast(errorText(e, 'Не удалось сохранить'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <Field label="Канал">
          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите канал" />
            </SelectTrigger>
            <SelectContent>
              {report.sourceOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Дата">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Сумма">
          <Input
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Комментарий">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Необязательно"
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'SPENT', label: 'Реализовано' },
            { value: 'PAID', label: 'Оплачено' },
          ]}
        />
        <Button onClick={() => void save()} disabled={busy || !sourceId || !amount}>
          <Plus />
          Добавить
        </Button>
      </div>
      <p className="text-fg-tertiary text-xs">
        «Реализовано» — бюджет, который канал уже открутил: из него считаются CPL, CPL-2 и CAC.
        «Оплачено» — пополнения кабинета и счета: показываются отдельно и в расчёт не идут.
      </p>

      {report.spends.length ? (
        <div className="border-border border">
          <table className="w-full text-sm">
            <tbody>
              {report.spends.map((s) => (
                <tr key={s.id} className="border-border border-b last:border-0">
                  <td className="nums text-fg-secondary px-3 py-2">
                    {s.date.split('-').reverse().join('.')}
                  </td>
                  <td className="px-3 py-2">{s.channel}</td>
                  <td className="text-fg-tertiary px-3 py-2 font-mono text-[11px] uppercase">
                    {s.kind === 'SPENT' ? 'реализовано' : 'оплачено'}
                  </td>
                  <td className="nums px-3 py-2 text-right">{formatRubStr(s.amount)}</td>
                  <td className="text-fg-tertiary hidden px-3 py-2 md:table-cell">{s.note}</td>
                  <td className="w-10 px-2 py-2 text-right">
                    <button
                      type="button"
                      aria-label="Удалить"
                      onClick={() => setRemoving(s.id)}
                      className="text-fg-tertiary hover:text-negative"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-fg-tertiary text-sm">За период расходов пока нет.</p>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(v) => !v && setRemoving(null)}
        title="Удалить расход?"
        description="Запись уйдёт из расчётов, удаление сохранится в истории."
        onConfirm={async () => {
          try {
            await apiFetch(`/api/marketing/spend/${removing}`, { method: 'DELETE' });
            toast('Расход удалён');
            onSaved();
          } catch (e) {
            toast(errorText(e, 'Не удалось удалить'), 'error');
          }
        }}
      />
    </div>
  );
}

function PlanForm({
  report,
  month,
  monthLabel,
  onSaved,
}: {
  report: MarketingReport;
  month: string;
  monthLabel: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const saved = report.plans.find((p) => p.sourceId === '');
  const [budget, setBudget] = React.useState(saved?.budget?.replace(/\.00$/, '') ?? '');
  const [leads, setLeads] = React.useState(saved?.leads?.toString() ?? '');
  const [qualified, setQualified] = React.useState(saved?.qualifiedLeads?.toString() ?? '');
  const [sales, setSales] = React.useState(saved?.sales?.toString() ?? '');
  const [busy, setBusy] = React.useState(false);

  const t = report.total;
  const rates = {
    qualifiedToSale: t.qualifiedToSale === null ? null : m(t.qualifiedToSale),
    leadToQualified: t.leadToQualified === null ? null : m(t.leadToQualified),
    cpl: t.cpl === null ? null : m(t.cpl),
  };
  const canReverse =
    intOrNull(sales) !== null && rates.qualifiedToSale !== null && rates.leadToQualified !== null;

  const reverse = () => {
    const r = reversePlan(intOrNull(sales) ?? 0, rates);
    if (r.qualified !== null) setQualified(String(r.qualified));
    if (r.leads !== null) setLeads(String(r.leads));
    if (r.budget !== null) setBudget(r.budget.toFixed(0));
  };

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch('/api/marketing/plan', {
        method: 'PUT',
        body: {
          month,
          sourceId: '',
          budget: budget.trim() === '' ? null : budget,
          leads: intOrNull(leads),
          qualifiedLeads: intOrNull(qualified),
          sales: intOrNull(sales),
        },
      });
      toast('План сохранён');
      onSaved();
    } catch (e) {
      toast(errorText(e, 'Не удалось сохранить'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fg-secondary text-sm">
        План на {monthLabel.toLowerCase()} по всем каналам.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Бюджет">
          <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
        </Field>
        <Field label="Лиды">
          <Input inputMode="numeric" value={leads} onChange={(e) => setLeads(e.target.value)} />
        </Field>
        <Field label="Квал. лиды">
          <Input
            inputMode="numeric"
            value={qualified}
            onChange={(e) => setQualified(e.target.value)}
          />
        </Field>
        <Field label="Продажи">
          <Input inputMode="numeric" value={sales} onChange={(e) => setSales(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button variant="secondary" onClick={reverse} disabled={!canReverse}>
            Обратный план от продаж
          </Button>
          <span className="text-fg-tertiary text-xs">
            Сколько нужно квал. лидов, лидов и бюджета на эти продажи при конверсиях и CPL за
            выбранный период.
          </span>
        </div>
        <Button onClick={() => void save()} disabled={busy}>
          Сохранить план
        </Button>
      </div>
    </div>
  );
}

function QualifiedForm({ report, onSaved }: { report: MarketingReport; onSaved: () => void }) {
  const { toast } = useToast();
  const [picked, setPicked] = React.useState(() => new Set(report.qualifiedStages));
  const [busy, setBusy] = React.useState(false);
  const usingDefault = picked.size === 0;

  const save = async (stages: string[]) => {
    setBusy(true);
    try {
      await apiFetch('/api/marketing/qualified-stages', { method: 'PUT', body: { stages } });
      toast('Сохранено');
      onSaved();
    } catch (e) {
      toast(errorText(e, 'Не удалось сохранить'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!report.stageOptions.length)
    return <p className="text-fg-tertiary text-sm">Стадии лидов не загрузились из Битрикс24.</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fg-secondary text-sm">
        Отметьте стадии, на которых лид считается квалифицированным. Пока ничего не отмечено, квал.
        лид — это лид, который ушёл дальше первой стадии или сконвертирован, кроме проваленных
        (отмечены серым).
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {report.stageOptions.map((s) => {
          const on = usingDefault ? s.qualifiedByDefault : picked.has(s.id);
          return (
            <label
              key={s.id}
              className={cn(
                'border-border flex cursor-pointer items-center gap-2 border px-3 py-2 text-sm',
                usingDefault && 'text-fg-secondary',
              )}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  const next = new Set(
                    usingDefault
                      ? report.stageOptions.filter((x) => x.qualifiedByDefault).map((x) => x.id)
                      : picked,
                  );
                  if (next.has(s.id)) next.delete(s.id);
                  else next.add(s.id);
                  setPicked(next);
                }}
                className="accent-[var(--accent)]"
              />
              {s.name}
              {s.semantic === 'fail' ? (
                <span className="text-fg-tertiary text-xs">провал</span>
              ) : null}
              {s.semantic === 'success' ? (
                <span className="text-positive text-xs">успех</span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {report.qualifiedStages.length ? (
          <Button variant="secondary" disabled={busy} onClick={() => void save([])}>
            Вернуть правило по умолчанию
          </Button>
        ) : null}
        <Button disabled={busy || usingDefault} onClick={() => void save([...picked])}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}

/**
 * «+ Расходы, план, обратный план» (ADR-048): spend per channel, the month's plan with the
 * reverse plan from sales, and which lead stages are qualified.
 */
export function MarketingEditor({
  report,
  month,
  monthLabel,
  today,
}: {
  report: MarketingReport;
  /** The month a plan is edited for: the selected month, or the current one. */
  month: string;
  monthLabel: string;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('spend');
  const refresh = () => router.refresh();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus />
        Расходы, план, обратный план
      </Button>
    );
  }

  return (
    <div className="border-accent bg-surface w-full border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'spend', label: 'Расходы' },
            { value: 'plan', label: 'План' },
            { value: 'qualified', label: 'Квал. лиды' },
          ]}
        />
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Закрыть"
          className="text-fg-tertiary hover:text-fg"
        >
          <X className="size-5" />
        </button>
      </div>
      {tab === 'spend' ? (
        <SpendForm report={report} today={today} onSaved={refresh} />
      ) : tab === 'plan' ? (
        <PlanForm
          key={month}
          report={report}
          month={month}
          monthLabel={monthLabel}
          onSaved={refresh}
        />
      ) : (
        <QualifiedForm report={report} onSaved={refresh} />
      )}
    </div>
  );
}

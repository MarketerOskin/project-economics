'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatRubStr } from '@/lib/format';
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

type Tab = 'spend' | 'qualified';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
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
 * «+ Расходы и квал. лиды» (ADR-048): spend per channel with its history, and which lead stages
 * are qualified. The plan and a channel's spend are also set by clicking the number (ADR-060).
 */
export function MarketingEditor({ report, today }: { report: MarketingReport; today: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('spend');
  const refresh = () => router.refresh();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus />
        Расходы и квал. лиды
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
      ) : (
        <QualifiedForm report={report} onSaved={refresh} />
      )}
    </div>
  );
}

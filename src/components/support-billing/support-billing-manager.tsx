'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDateTime, formatRubStr } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SupportMonthDto } from '@/server/services/support-billing';
import type { CategoryDto } from '@/server/services/categories';

const keyOf = (r: SupportMonthDto) => `${r.projectId}:${r.month}`;

/** A category whose name hints at the purpose, else the first one. */
function guess(categories: CategoryDto[], pattern: RegExp): string {
  return (categories.find((c) => pattern.test(c.name)) ?? categories[0])?.id ?? '';
}

function CategorySelect({
  label,
  value,
  onChange,
  categories,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  categories: CategoryDto[];
}) {
  return (
    <label className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
      <span className="tx-mark text-fg-tertiary">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Выберите статью" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Status({ row }: { row: SupportMonthDto }) {
  if (!row.posted)
    return <span className="text-fg-tertiary font-mono text-[11px] uppercase">не проведено</span>;
  if (row.changed)
    return (
      <span className="text-warning font-mono text-[11px] font-bold uppercase">
        часы изменились
      </span>
    );
  return (
    <span className="text-positive font-mono text-[11px] uppercase">
      проведено {formatDateTime(new Date(row.posted.at))}
    </span>
  );
}

function MonthRow({
  row,
  busy,
  onPost,
}: {
  row: SupportMonthDto;
  busy: boolean;
  onPost: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const profitNegative = row.profit.startsWith('-');
  return (
    <div className="border-border bg-surface border">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-[14rem] flex-1 items-start gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="text-fg-tertiary mt-0.5 size-4 shrink-0" />
          ) : (
            <ChevronRight className="text-fg-tertiary mt-0.5 size-4 shrink-0" />
          )}
          <span>
            <span className="text-fg block font-medium">{row.projectName}</span>
            <span className="text-fg-tertiary block text-xs">
              {row.monthLabel}
              {row.current ? ' · месяц идёт' : ''} · {row.hours} ч
            </span>
          </span>
        </button>
        <div className="grid grid-cols-3 gap-6 text-right">
          <div>
            <div className="tx-mark text-fg-tertiary">Доход</div>
            <div className="nums">{formatRubStr(row.income)}</div>
          </div>
          <div>
            <div className="tx-mark text-fg-tertiary">Расход</div>
            <div className="nums">{formatRubStr(row.expense)}</div>
          </div>
          <div>
            <div className="tx-mark text-fg-tertiary">Прибыль</div>
            <div
              className={cn('nums font-medium', profitNegative ? 'text-negative' : 'text-positive')}
            >
              {formatRubStr(row.profit)}
            </div>
          </div>
        </div>
        <div className="flex min-w-[11rem] flex-col items-end gap-1.5">
          <Status row={row} />
          <Button
            size="sm"
            variant={row.posted && !row.changed ? 'secondary' : 'primary'}
            onClick={onPost}
            disabled={busy}
          >
            {row.posted ? 'Пересчитать' : 'Провести'}
          </Button>
        </div>
      </div>
      {row.missingRates.length ? (
        <p className="border-border bg-warning-soft text-fg-secondary border-t px-4 py-2 text-xs">
          Нет часовой ставки: {row.missingRates.join(', ')}. Их часы не попадут в расход, пока
          ставка не задана в{' '}
          <Link href="/settings#team" className="text-accent underline underline-offset-2">
            команде
          </Link>
          .
        </p>
      ) : null}
      {open ? (
        <div className="border-border border-t px-4 py-3">
          {row.workers.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-tertiary text-left font-mono text-[11px] tracking-[0.06em] uppercase">
                  <th className="py-1.5 font-medium">Специалист</th>
                  <th className="py-1.5 text-right font-medium">Часы</th>
                  <th className="py-1.5 text-right font-medium">Ставка</th>
                  <th className="py-1.5 text-right font-medium">Расход</th>
                </tr>
              </thead>
              <tbody>
                {row.workers.map((w) => (
                  <tr key={w.name} className="border-border border-t">
                    <td className="py-1.5">{w.name}</td>
                    {w.viaTimeDrafts ? (
                      <td className="text-fg-tertiary py-1.5 text-right text-xs" colSpan={3}>
                        уже учтён в «Часах к подтверждению»
                      </td>
                    ) : (
                      <>
                        <td className="nums py-1.5 text-right">{w.hours.replace('.', ',')}</td>
                        <td className="nums py-1.5 text-right">
                          {w.rate ? formatRubStr(w.rate) : '—'}
                        </td>
                        <td className="nums py-1.5 text-right">{formatRubStr(w.amount)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-fg-tertiary text-sm">Часов сотрудников за месяц нет.</p>
          )}
          {row.posted ? (
            <p className="text-fg-tertiary mt-2 text-xs">
              В финансах сейчас: доход {formatRubStr(row.posted.income)}, расход{' '}
              {formatRubStr(row.posted.expense)}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Support projects' income and expense from hours (ADR-045): computed from Bitrix24 hours,
 * written to finance with one click. Loads on the client, since it reads Bitrix24 live.
 */
export function SupportBillingManager({
  incomeCategories,
  expenseCategories,
}: {
  incomeCategories: CategoryDto[];
  expenseCategories: CategoryDto[];
}) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SupportMonthDto[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  const [incomeCategoryId, setIncome] = React.useState(() =>
    guess(incomeCategories, /поддерж|сопровожд|абонент/i),
  );
  const [expenseCategoryId, setExpense] = React.useState(() =>
    guess(expenseCategories, /внутрен|зарплат|сотрудник|специалист|фот/i),
  );

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<{ months: SupportMonthDto[] }>('/api/support-billing');
      setRows(res.months);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить часы');
    }
  }, []);

  React.useEffect(() => {
    // Fetch-on-mount: the rows arrive after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const post = async (list: SupportMonthDto[]) => {
    if (!incomeCategoryId || !expenseCategoryId) {
      toast('Выберите статьи дохода и расхода', 'error');
      return;
    }
    setBusy(new Set(list.map(keyOf)));
    let done = 0;
    for (const r of list) {
      try {
        await apiFetch('/api/support-billing/post', {
          method: 'POST',
          body: { projectId: r.projectId, month: r.month, incomeCategoryId, expenseCategoryId },
        });
        done++;
      } catch (e) {
        toast(
          `${r.projectName}: ${e instanceof Error ? e.message : 'не удалось провести'}`,
          'error',
        );
      }
    }
    setBusy(new Set());
    if (done) toast(done === 1 ? 'Записано в финансы проекта' : `Записано в финансы: ${done}`);
    await load();
  };

  if (error) {
    return (
      <div className="border-border text-fg-secondary flex flex-wrap items-center gap-3 border border-dashed px-4 py-3 text-sm">
        {error}
        <Button size="sm" variant="secondary" onClick={() => void load()}>
          <RefreshCw />
          Повторить
        </Button>
      </div>
    );
  }
  if (!rows) return <div className="bg-surface-muted h-24 animate-pulse" />;
  if (!rows.length) {
    return (
      <p className="text-fg-tertiary text-sm">
        Нет проектов с ценой часа. Задайте цену часа или абонентскую плату во вкладке «Аналитика»
        проекта, в блоке «Пакет часов».
      </p>
    );
  }

  const pending = rows.filter((r) => !r.current && (!r.posted || r.changed));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <CategorySelect
          label="Статья дохода"
          value={incomeCategoryId}
          onChange={setIncome}
          categories={incomeCategories}
        />
        <CategorySelect
          label="Статья расхода"
          value={expenseCategoryId}
          onChange={setExpense}
          categories={expenseCategories}
        />
        {pending.length > 1 ? (
          <Button onClick={() => void post(pending)} disabled={busy.size > 0}>
            Провести прошлый месяц ({pending.length})
          </Button>
        ) : null}
      </div>
      {rows.map((r) => (
        <MonthRow key={keyOf(r)} row={r} busy={busy.has(keyOf(r))} onPost={() => void post([r])} />
      ))}
    </div>
  );
}

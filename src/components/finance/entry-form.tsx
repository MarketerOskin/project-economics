'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { m } from '@/domain/finance/money';
import { hoursRateAmount } from '@/domain/finance';
import { formatRub } from '@/lib/format';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Option {
  id: string;
  name: string;
  kind?: 'INCOME' | 'EXPENSE';
}

type Direction = 'INCOME' | 'EXPENSE';
type Budget = 'PLAN' | 'FACT';
type Mode = 'FIXED' | 'HOURS_RATE';

const HOURS_FIRST = new Set(['Внешние программисты', 'Внутренние программисты']);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export interface EntryFormInitial {
  id: string;
  direction: Direction;
  budgetType: Budget;
  projectId: string;
  categoryId: string;
  operationDate: string;
  calculationMode: Mode;
  amount: string;
  hours: string | null;
  hourlyRate: string | null;
  employeeId: string | null;
  description: string | null;
  comment: string | null;
  contractorName: string | null;
  counterpartyName: string | null;
  invoiceNumber: string | null;
  documentUrl: string | null;
}

export function EntryForm({
  lockedProjectId,
  initial,
  onDone,
}: {
  lockedProjectId?: string;
  initial?: EntryFormInitial;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const isEdit = Boolean(initial?.id);
  const [projects, setProjects] = React.useState<Option[]>([]);
  const [categories, setCategories] = React.useState<Option[]>([]);
  const [users, setUsers] = React.useState<{ id: string; fullName: string }[]>([]);

  const [direction, setDirection] = React.useState<Direction>(initial?.direction ?? 'EXPENSE');
  const [budget, setBudget] = React.useState<Budget>(initial?.budgetType ?? 'FACT');
  const [projectId, setProjectId] = React.useState(initial?.projectId ?? lockedProjectId ?? '');
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? '');
  const [date, setDate] = React.useState(initial?.operationDate ?? todayIso());
  const [mode, setMode] = React.useState<Mode>(initial?.calculationMode ?? 'FIXED');
  const [amount, setAmount] = React.useState(initial && initial.calculationMode === 'FIXED' ? initial.amount : '');
  const [hours, setHours] = React.useState(initial?.hours ?? '');
  const [rate, setRate] = React.useState(initial?.hourlyRate ?? '');
  const [employeeId, setEmployeeId] = React.useState(initial?.employeeId ?? '');
  const [showExtra, setShowExtra] = React.useState(
    Boolean(
      initial?.description ||
        initial?.comment ||
        initial?.invoiceNumber ||
        initial?.contractorName ||
        initial?.counterpartyName ||
        initial?.documentUrl,
    ),
  );
  const [extra, setExtra] = React.useState({
    contractorName: initial?.contractorName ?? '',
    counterpartyName: initial?.counterpartyName ?? '',
    invoiceNumber: initial?.invoiceNumber ?? '',
    description: initial?.description ?? '',
    comment: initial?.comment ?? '',
    documentUrl: initial?.documentUrl ?? '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ projects: { id: string; name: string }[] }>('/api/projects?status=ALL')
      .then((r) => setProjects(r.projects))
      .catch(() => undefined);
    apiFetch<{ categories: Option[] }>('/api/categories')
      .then((r) => setCategories(r.categories))
      .catch(() => undefined);
    apiFetch<{ users: { id: string; fullName: string }[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch(() => undefined);
  }, []);

  const visibleCategories = categories.filter((c) => c.kind === direction);

  // INCOME is always FIXED (ТЗ §14). Derive rather than store.
  const effectiveMode: Mode = direction === 'INCOME' ? 'FIXED' : mode;

  const pickCategory = (id: string) => {
    setCategoryId(id);
    // Suggest HOURS_RATE first for developer expense categories (ТЗ §14) — still switchable.
    const cat = categories.find((c) => c.id === id);
    if (direction === 'EXPENSE' && cat && HOURS_FIRST.has(cat.name)) setMode('HOURS_RATE');
  };

  const liveAmount =
    effectiveMode === 'HOURS_RATE' && hours && rate
      ? (() => {
          try {
            return hoursRateAmount(m(hours), m(rate));
          } catch {
            return null;
          }
        })()
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSubmitting(true);
    const body: Record<string, unknown> = {
      projectId,
      categoryId,
      direction,
      budgetType: budget,
      operationDate: date,
      calculationMode: effectiveMode,
      ...(effectiveMode === 'FIXED' ? { amount } : { hours, hourlyRate: rate }),
      ...(employeeId ? { employeeId } : {}),
    };
    for (const [k, v] of Object.entries(extra)) if (v) body[k] = v;

    try {
      if (isEdit && initial) {
        await apiFetch(`/api/finance/${initial.id}`, { method: 'PATCH', body });
        toast(direction === 'INCOME' ? 'Доход обновлён' : 'Расход обновлён');
      } else {
        await apiFetch('/api/finance', { method: 'POST', body });
        toast(direction === 'INCOME' ? 'Доход добавлен' : 'Расход добавлен');
      }
      onDone?.();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      else toast(err instanceof Error ? err.message : 'Не удалось сохранить', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'INCOME', label: 'Доход' },
            { value: 'EXPENSE', label: 'Расход' },
          ]}
        />
        <Segmented
          value={budget}
          onChange={setBudget}
          options={[
            { value: 'PLAN', label: 'План' },
            { value: 'FACT', label: 'Факт' },
          ]}
        />
      </div>

      {!lockedProjectId ? (
        <Field label="Проект" error={errors.projectId}>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите проект" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Статья" error={errors.categoryId}>
          <Select value={categoryId} onValueChange={pickCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите статью" />
            </SelectTrigger>
            <SelectContent>
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Дата" htmlFor="opdate" error={errors.operationDate}>
          <Input id="opdate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {direction === 'EXPENSE' ? (
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'FIXED', label: 'Фиксированная сумма' },
            { value: 'HOURS_RATE', label: 'Часы × ставка' },
          ]}
        />
      ) : null}

      {effectiveMode === 'FIXED' ? (
        <Field label="Сумма" htmlFor="amount" error={errors.amount}>
          <Input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
            placeholder="50000"
          />
        </Field>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Количество часов" htmlFor="hours" error={errors.hours}>
            <Input
              id="hours"
              inputMode="decimal"
              value={hours}
              onChange={(e) => setHours(e.target.value.replace(',', '.'))}
              placeholder="12.5"
            />
          </Field>
          <Field label="Стоимость часа" htmlFor="rate" error={errors.hourlyRate}>
            <Input
              id="rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(',', '.'))}
              placeholder="2000"
            />
          </Field>
          <div className="col-span-2 rounded-[10px] bg-surface-muted px-3 py-2 text-sm">
            Итого:{' '}
            <span className="font-medium nums">
              {liveAmount ? formatRub(liveAmount) : '—'}
            </span>
            {liveAmount ? (
              <span className="ml-1 text-fg-tertiary">
                ({hours} ч × {formatRub(m(rate))})
              </span>
            ) : null}
            <span className="ml-2 text-xs text-fg-tertiary">итог пересчитывается на сервере</span>
          </div>
        </div>
      )}

      {direction === 'EXPENSE' ? (
        <Field label="Исполнитель" error={errors.employeeId}>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Не указан" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <button
        type="button"
        onClick={() => setShowExtra((v) => !v)}
        className="flex items-center gap-1 text-sm text-fg-secondary hover:text-fg"
      >
        <ChevronDown className={cn('size-4 transition-transform', showExtra && 'rotate-180')} />
        Дополнительные данные
      </button>

      {showExtra ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-[12px] border border-border p-4">
          {direction === 'EXPENSE' ? (
            <Field label="Подрядчик">
              <Input
                value={extra.contractorName}
                onChange={(e) => setExtra({ ...extra, contractorName: e.target.value })}
              />
            </Field>
          ) : (
            <Field label="Контрагент">
              <Input
                value={extra.counterpartyName}
                onChange={(e) => setExtra({ ...extra, counterpartyName: e.target.value })}
              />
            </Field>
          )}
          <Field label="Номер счёта / документа">
            <Input
              value={extra.invoiceNumber}
              onChange={(e) => setExtra({ ...extra, invoiceNumber: e.target.value })}
            />
          </Field>
          <Field label="Ссылка на документ" error={errors.documentUrl}>
            <Input
              value={extra.documentUrl}
              onChange={(e) => setExtra({ ...extra, documentUrl: e.target.value })}
              placeholder="https://"
            />
          </Field>
          <div className="col-span-2">
            <Field label="Описание / назначение">
              <Textarea
                value={extra.description}
                onChange={(e) => setExtra({ ...extra, description: e.target.value })}
              />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Комментарий">
              <Textarea
                value={extra.comment}
                onChange={(e) => setExtra({ ...extra, comment: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить операцию'}
        </Button>
        {onDone ? (
          <Button type="button" variant="secondary" onClick={onDone}>
            Отмена
          </Button>
        ) : null}
      </div>
    </form>
  );
}

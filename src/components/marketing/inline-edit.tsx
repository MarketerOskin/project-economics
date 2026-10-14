'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import { Minus, Plus } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatNumber, formatRubStr } from '@/lib/format';
import { m } from '@/domain/finance/money';
import { adjustSpend, reversePlan } from '@/domain/finance/marketing';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import type { PlanDto } from '@/server/services/marketing';

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const clean = (s: string) => s.replace(/\s/g, '').replace(',', '.');
const validAmount = (s: string) => /^\d+(\.\d{1,2})?$/.test(clean(s)) && m(clean(s)).gt(0);

/**
 * A number that opens a small editor under itself when clicked (ADR-060). The panel is
 * portalled, so a scrolling table does not clip it; Escape or a click outside closes it.
 */
function NumberPopover({
  label,
  display,
  className,
  children,
}: {
  label: string;
  display: React.ReactNode;
  className?: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'hover:text-accent decoration-accent cursor-pointer underline decoration-dashed underline-offset-4',
            className,
          )}
        >
          {display}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="border-border bg-surface text-fg z-50 w-72 border p-3 text-left text-sm shadow-lg"
        >
          {children(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * A channel's spend in the «Каналы» table. Zero: type the amount. Otherwise add to it or take
 * off; each change is its own audited spend row on `date`.
 */
export function SpendCell({
  sourceId,
  channel,
  spent,
  date,
}: {
  sourceId: string;
  channel: string;
  spent: string;
  date: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const empty = m(spent).isZero();
  const [subtract, setSubtract] = React.useState(false);
  const [amount, setAmount] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const next = validAmount(amount) ? adjustSpend(m(spent), m(clean(amount)), subtract) : undefined;

  const save = async (close: () => void) => {
    if (!validAmount(amount) || next === null) return;
    setBusy(true);
    try {
      await apiFetch('/api/marketing/spend', {
        method: 'POST',
        body: { sourceId, channel, date, kind: 'SPENT', amount: clean(amount), subtract },
      });
      toast(subtract ? 'Расход уменьшен' : 'Расход добавлен');
      setAmount('');
      close();
      router.refresh();
    } catch (e) {
      toast(errorText(e, 'Не удалось сохранить'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <NumberPopover label={`Изменить расход: ${channel}`} display={formatRubStr(spent)}>
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save(close);
          }}
        >
          <span className="text-fg-secondary text-xs">
            {channel} · {date.split('-').reverse().join('.')}
          </span>
          <span className="flex gap-2">
            {empty ? null : (
              <span className="border-border inline-flex border">
                <button
                  type="button"
                  aria-label="Прибавить"
                  aria-pressed={!subtract}
                  onClick={() => setSubtract(false)}
                  className={cn(
                    'px-2',
                    !subtract ? 'bg-accent text-accent-fg' : 'text-fg-secondary',
                  )}
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Убавить"
                  aria-pressed={subtract}
                  onClick={() => setSubtract(true)}
                  className={cn(
                    'px-2',
                    subtract ? 'bg-accent text-accent-fg' : 'text-fg-secondary',
                  )}
                >
                  <Minus className="size-4" />
                </button>
              </span>
            )}
            <Input
              autoFocus
              inputMode="decimal"
              placeholder={
                empty ? 'Сумма расхода' : subtract ? 'Сколько убавить' : 'Сколько прибавить'
              }
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </span>
          {empty || next === undefined ? null : next === null ? (
            <span className="text-negative text-xs">Больше, чем внесено за период</span>
          ) : (
            <span className="text-fg-secondary text-xs">
              Станет {formatRubStr(next.toFixed(2))}
            </span>
          )}
          <Button type="submit" size="sm" disabled={busy || !validAmount(amount) || next === null}>
            Сохранить
          </Button>
        </form>
      )}
    </NumberPopover>
  );
}

type PlanKey = 'budget' | 'leads' | 'qualifiedLeads' | 'sales';

const PLAN_FIELDS: Array<{ key: PlanKey; label: string; money: boolean }> = [
  { key: 'budget', label: 'Бюджет', money: true },
  { key: 'leads', label: 'Лиды', money: false },
  { key: 'qualifiedLeads', label: 'Квал. лиды', money: false },
  { key: 'sales', label: 'Продажи', money: false },
];

/**
 * «План на месяц» (ADR-060): the month's targets for all channels, each set by clicking its
 * number, and the reverse plan from sales at the period's conversions and CPL.
 */
export function PlanBoard({
  month,
  plan,
  rates,
}: {
  month: string;
  plan: PlanDto | null;
  rates: { qualifiedToSale: string | null; leadToQualified: string | null; cpl: string | null };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);
  const current = {
    budget: plan?.budget ?? null,
    leads: plan?.leads ?? null,
    qualifiedLeads: plan?.qualifiedLeads ?? null,
    sales: plan?.sales ?? null,
  };

  const put = async (patch: Partial<typeof current>, done: string) => {
    setBusy(true);
    try {
      await apiFetch('/api/marketing/plan', {
        method: 'PUT',
        body: { month, sourceId: '', ...current, ...patch },
      });
      toast(done);
      router.refresh();
      return true;
    } catch (e) {
      toast(errorText(e, 'Не удалось сохранить'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const r = {
    qualifiedToSale: rates.qualifiedToSale === null ? null : m(rates.qualifiedToSale),
    leadToQualified: rates.leadToQualified === null ? null : m(rates.leadToQualified),
    cpl: rates.cpl === null ? null : m(rates.cpl),
  };
  const canReverse =
    current.sales !== null && r.qualifiedToSale !== null && r.leadToQualified !== null;

  return (
    <div className="flex flex-col gap-3">
      <div className="border-border bg-surface grid grid-cols-2 border lg:grid-cols-4">
        {PLAN_FIELDS.map((f) => {
          const v = current[f.key];
          return (
            <div
              key={f.key}
              className="border-border flex flex-col gap-1 border-r border-b p-4 last:border-r-0"
            >
              <span className="text-fg-tertiary font-mono text-[11px] tracking-[0.06em] uppercase">
                {f.label}
              </span>
              <span className="nums text-xl font-medium">
                <PlanValue
                  key={v === null ? '' : String(v)}
                  label={f.label}
                  money={f.money}
                  value={v === null ? null : String(v)}
                  busy={busy}
                  onSave={(s) =>
                    put(
                      { [f.key]: s === null ? null : f.money ? s : Math.round(Number(s)) },
                      'План сохранён',
                    )
                  }
                />
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canReverse || busy}
          onClick={() => {
            const x = reversePlan(current.sales ?? 0, r);
            void put(
              {
                ...(x.qualified !== null ? { qualifiedLeads: x.qualified } : {}),
                ...(x.leads !== null ? { leads: x.leads } : {}),
                ...(x.budget !== null ? { budget: x.budget.toFixed(0) } : {}),
              },
              'План пересчитан от продаж',
            );
          }}
        >
          Рассчитать от продаж
        </Button>
        <span className="text-fg-tertiary text-xs">
          Заполнит квал. лиды, лиды и бюджет под план продаж при конверсиях и CPL за выбранный
          период.
        </span>
      </div>
    </div>
  );
}

function PlanValue({
  label,
  money,
  value,
  busy,
  onSave,
}: {
  label: string;
  money: boolean;
  value: string | null;
  busy: boolean;
  onSave: (v: string | null) => Promise<boolean>;
}) {
  const shown = value === null ? 'Задать' : money ? formatRubStr(value) : formatNumber(m(value));
  const [text, setText] = React.useState(value === null ? '' : value.replace(/\.00$/, ''));
  const ok = text.trim() === '' || /^\d+([.,]\d{1,2})?$/.test(text.replace(/\s/g, ''));

  return (
    <NumberPopover
      label={`Изменить план: ${label}`}
      display={shown}
      className={value === null ? 'text-fg-tertiary text-base' : undefined}
    >
      {(close) => (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            const s = text.trim() === '' ? null : clean(text);
            void onSave(s).then((saved) => saved && close());
          }}
        >
          <span className="text-fg-secondary text-xs">План · {label}</span>
          <Input
            autoFocus
            inputMode={money ? 'decimal' : 'numeric'}
            placeholder="Пусто — без плана"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={busy || !ok}>
            Сохранить
          </Button>
        </form>
      )}
    </NumberPopover>
  );
}

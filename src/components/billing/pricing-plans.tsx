'use client';

import * as React from 'react';
import { Check, Clock3, X } from 'lucide-react';
import type { Plan } from '@prisma/client';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDate, formatRubStr } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';

interface PendingLead {
  id: string;
  contact: string;
  comment: string | null;
  status: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'DECLINED';
  createdAt: string;
}

const FREE_FEATURES = [
  { label: 'Неограниченное число проектов', included: true },
  { label: 'Доход и расход, план и факт', included: true },
  { label: 'Дашборд, графики, история изменений', included: true },
  { label: 'Роли и права доступа сотрудников', included: true },
  { label: 'Импорт проекта из сделки/компании Битрикс24', included: false },
];

const PRO_FEATURES = [
  { label: 'Всё из Free', included: true },
  { label: 'Импорт проекта из сделки/компании Битрикс24', included: true },
];

function PlanCard({
  title,
  price,
  features,
  highlighted,
  isCurrent,
  footer,
}: {
  title: string;
  price: string;
  features: { label: string; included: boolean }[];
  highlighted?: boolean;
  isCurrent: boolean;
  footer: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-[18px] border p-6',
        highlighted ? 'border-accent bg-accent-soft/40' : 'border-border bg-surface',
      )}
    >
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {isCurrent ? (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">
              ваш тариф
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{price}</p>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-2">
            {f.included ? (
              <Check className="mt-0.5 size-4 shrink-0 text-positive" />
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-fg-tertiary" />
            )}
            <span className={f.included ? 'text-fg' : 'text-fg-tertiary'}>{f.label}</span>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  );
}

function RequestProDialog({ open, onOpenChange, onSubmitted }: { open: boolean; onOpenChange: (v: boolean) => void; onSubmitted: (lead: PendingLead) => void }) {
  const { toast } = useToast();
  const [contact, setContact] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await apiFetch<{ id: string }>('/api/billing/pro-lead', { method: 'POST', body: { contact, comment: comment || undefined } });
      toast('Заявка отправлена — мы свяжемся с вами');
      onSubmitted({ id: 'pending', contact, comment: comment || null, status: 'NEW', createdAt: new Date().toISOString() });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title="Заявка на Pro" description="Оставьте контакт — мы свяжемся и подключим тариф" />
        <form onSubmit={submit} className="space-y-4">
          <Field label="Как связаться" htmlFor="contact" error={error} hint="Email, телефон или Telegram">
            <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@company.ru" required autoFocus />
          </Field>
          <Field label="Комментарий (необязательно)">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: сколько сотрудников, что важно" />
          </Field>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Отправка…' : 'Отправить заявку'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PricingPlans({ currentPlan, isDemo }: { currentPlan: Plan; isDemo: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PendingLead | null | undefined>(undefined);

  React.useEffect(() => {
    apiFetch<{ pending: boolean; lead: PendingLead | null }>('/api/billing/pro-lead')
      .then((r) => setPending(r.lead))
      .catch(() => setPending(null));
  }, []);

  const proFooter =
    currentPlan === 'PRO' ? (
      <p className="text-sm text-fg-secondary">Спасибо, что пользуетесь Pro.</p>
    ) : pending ? (
      <div className="flex items-start gap-2 rounded-[10px] border border-dashed border-border bg-surface-muted px-3 py-2.5 text-sm text-fg-secondary">
        <Clock3 className="mt-0.5 size-4 shrink-0 text-fg-tertiary" />
        <span>
          Заявка отправлена {formatDate(new Date(pending.createdAt))} ({pending.contact}) — мы свяжемся.
        </span>
      </div>
    ) : (
      <Button onClick={() => setDialogOpen(true)} disabled={pending === undefined}>
        Оформить Pro
      </Button>
    );

  return (
    <div className="max-w-3xl">
      {isDemo ? (
        <p className="mb-6 rounded-[10px] border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-fg-secondary">
          Это демо-портал — здесь всегда открыт весь функционал. Тарифы ниже относятся к
          реальной установке приложения на портал Битрикс24.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <PlanCard title="Free" price={formatRubStr('0')} features={FREE_FEATURES} isCurrent={currentPlan === 'FREE' && !isDemo} footer={<p className="text-sm text-fg-tertiary">Бесплатно, без ограничения по времени</p>} />
        <PlanCard
          title="Pro"
          price={`${formatRubStr('1000')} / мес за портал`}
          features={PRO_FEATURES}
          highlighted
          isCurrent={currentPlan === 'PRO' && !isDemo}
          footer={proFooter}
        />
      </div>

      <p className="mt-4 text-xs text-fg-tertiary">
        Pro — дополнительный функционал, он оплачивается отдельно от сертификата Битрикс24
        Маркетплейс. Основной функционал (Free) работает без ограничений.
      </p>

      <RequestProDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmitted={setPending} />
    </div>
  );
}

'use client';

import * as React from 'react';
import { Clock3 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';

interface PendingLead {
  contact: string;
  createdAt: string;
}

/**
 * "Set the app up for how we work" request (ADR-038). Lands in the operator panel next to
 * Pro requests; one open request per portal at a time.
 */
export function ImplementationRequest() {
  const { toast } = useToast();
  const [pending, setPending] = React.useState<PendingLead | null | undefined>(undefined);
  const [contact, setContact] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ lead: PendingLead | null }>('/api/billing/pro-lead?kind=IMPLEMENTATION')
      .then((r) => setPending(r.lead))
      .catch(() => setPending(null));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await apiFetch('/api/billing/pro-lead', {
        method: 'POST',
        body: { contact, comment: comment || undefined, kind: 'IMPLEMENTATION' },
      });
      toast('Заявка отправлена — мы свяжемся с вами');
      setPending({ contact, createdAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  if (pending === undefined) return null;

  if (pending) {
    return (
      <div className="flex max-w-2xl items-start gap-2 border border-dashed border-border bg-surface-muted px-4 py-3 text-sm text-fg-secondary">
        <Clock3 className="mt-0.5 size-4 shrink-0 text-fg-tertiary" />
        <span>
          Заявка отправлена {formatDate(new Date(pending.createdAt))} ({pending.contact}) — мы свяжемся и
          договоримся о созвоне.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <p className="text-sm text-fg-secondary">
        Если приложение не подошло к тому, как у вас устроена работа в Битрикс24 — проекты в
        смарт-процессах, свои поля, задачи в нескольких местах, — оставьте заявку. Мы разберём ваш
        портал и настроим приложение под вашу модель.
      </p>
      <Field label="Как связаться" htmlFor="impl-contact" error={error} hint="Email, телефон или Telegram">
        <Input
          id="impl-contact"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@company.ru"
          required
        />
      </Field>
      <Field label="Что не подошло или как вы работаете (необязательно)">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например: проекты ведём в смарт-процессе «Проекты», задачи — в «Заявках», время отмечаем в задачах"
        />
      </Field>
      <Button type="submit" disabled={submitting}>
        {submitting ? 'Отправка…' : 'Оставить заявку на внедрение'}
      </Button>
    </form>
  );
}

'use client';

import * as React from 'react';
import { Clock3, Plug } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';

interface PendingLead {
  contact: string;
  createdAt: string;
}

/**
 * «Интеграция с 1С» (ADR-050): a pill in the finance section that opens a short request form.
 * The request lands in the operator panel next to Pro and implementation requests.
 */
export function OneCRequest() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<PendingLead | null | undefined>(undefined);
  const [contact, setContact] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ lead: PendingLead | null }>('/api/billing/pro-lead?kind=INTEGRATION_1C')
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
        body: { contact, comment: comment || undefined, kind: 'INTEGRATION_1C' },
      });
      toast('Заявка отправлена — мы свяжемся с вами');
      setPending({ contact, createdAt: new Date().toISOString() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="border-accent text-accent hover:bg-accent hover:text-bg my-1.5 inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors"
        >
          <Plug className="size-3.5" />
          Интеграция с 1С
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader
          title="Интеграция с 1С"
          description="Доходы и расходы из 1С будут попадать в проекты сами, без ручного ввода."
        />
        {pending ? (
          <div className="border-border bg-surface-muted text-fg-secondary flex items-start gap-2 border border-dashed px-4 py-3 text-sm">
            <Clock3 className="text-fg-tertiary mt-0.5 size-4 shrink-0" />
            <span>
              Заявка отправлена {formatDate(new Date(pending.createdAt))} ({pending.contact}) — мы
              свяжемся и обсудим, какие документы 1С подтягивать.
            </span>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Как связаться"
              htmlFor="onec-contact"
              error={error}
              hint="Email, телефон или Telegram"
            >
              <Input
                id="onec-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="you@company.ru"
                required
              />
            </Field>
            <Field label="Какая у вас 1С и что подтягивать (необязательно)">
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: 1С:Бухгалтерия 3.0, поступления и списания по договорам"
              />
            </Field>
            <Button type="submit" disabled={submitting || pending === undefined}>
              {submitting ? 'Отправка…' : 'Оставить заявку'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

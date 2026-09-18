'use client';

import * as React from 'react';
import { Bug } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';

/** Floating "report a bug" entry point — lands directly in the developer's own CRM. */
export function BugReportButton() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [error, setError] = React.useState<string | undefined>();
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setSubmitting(true);
    try {
      await apiFetch('/api/support/bug-report', {
        method: 'POST',
        body: { description, pageUrl: window.location.pathname },
      });
      toast('Спасибо, сообщение отправлено разработчику');
      setDescription('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Сообщить о проблеме"
        className="fixed bottom-4 right-4 z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg-secondary shadow-lg transition-colors hover:text-fg"
      >
        <Bug className="size-5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader
            title="Сообщить о проблеме"
            description="Опишите, что пошло не так — сообщение напрямую придёт разработчику"
          />
          <form onSubmit={submit} className="space-y-4">
            <Field label="Описание" htmlFor="bug-description" error={error}>
              <Textarea
                id="bug-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Что произошло, на какой странице, что вы ожидали увидеть"
                required
                autoFocus
              />
            </Field>
            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Отправка…' : 'Отправить'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Отмена
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

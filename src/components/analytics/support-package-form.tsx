'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { RUB_SIGN } from '@/lib/format';

interface Values {
  hoursLimit: string;
  monthlyFee: string;
  hourRate: string;
}

/** Monthly hours package, fee and overage rate of a project (managers/admins). */
export function SupportPackageForm({ projectId, initial }: { projectId: string; initial: Values }) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = React.useState<Values>(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await apiFetch(`/api/projects/${projectId}/support-package`, { method: 'PATCH', body: values });
      toast('Пакет часов сохранён');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      toast(err instanceof ApiError ? err.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4 border border-border bg-surface p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
      <Field label="Часов в месяц" htmlFor="sp-hours" error={errors.hoursLimit} hint="Пусто — без пакета">
        <Input id="sp-hours" inputMode="decimal" value={values.hoursLimit} onChange={set('hoursLimit')} placeholder="4" />
      </Field>
      <Field label={`Абонентская плата, ${RUB_SIGN} в месяц`} htmlFor="sp-fee" error={errors.monthlyFee}>
        <Input id="sp-fee" inputMode="decimal" value={values.monthlyFee} onChange={set('monthlyFee')} placeholder="0" />
      </Field>
      <Field
        label={`Цена часа, ${RUB_SIGN}`}
        htmlFor="sp-rate"
        error={errors.hourRate}
        hint="Сверх пакета, а без пакета и абонентки — за каждый час"
      >
        <Input id="sp-rate" inputMode="decimal" value={values.hourRate} onChange={set('hourRate')} placeholder="0" />
      </Field>
      <Button type="submit" disabled={saving}>
        {saving ? 'Сохраняю…' : 'Сохранить'}
      </Button>
    </form>
  );
}

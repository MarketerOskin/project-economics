'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/client/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export default function OperatorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/operator/login', { method: 'POST', body: { email, password } });
      router.push('/operator');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-[18px] border border-border bg-surface p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Вход оператора</h1>
          <p className="mt-1 text-sm text-fg-secondary">Служебная панель — не для клиентов Bitrix24</p>
        </div>

        <Field label="Email">
          <Input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Пароль" error={error ?? undefined}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Вход…' : 'Войти'}
        </Button>
      </form>
    </div>
  );
}

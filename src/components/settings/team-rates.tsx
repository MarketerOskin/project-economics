'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Input } from '@/components/ui/field';

export interface TeamMemberDto {
  id: string;
  fullName: string;
  position: string | null;
  roleLabel: string;
  hourlyRate: string | null;
}

function RateInput({ userId, initial }: { userId: string; initial: string | null }) {
  const { toast } = useToast();
  const [value, setValue] = React.useState(initial ?? '');
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    const trimmed = value.trim();
    const hourlyRate = trimmed === '' ? null : Number(trimmed.replace(',', '.'));
    if (hourlyRate !== null && (!Number.isFinite(hourlyRate) || hourlyRate < 0)) {
      toast('Ставка должна быть неотрицательным числом', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/users/${userId}`, { method: 'PATCH', body: { hourlyRate } });
      toast('Ставка сохранена');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить ставку', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder="не задана"
        disabled={saving}
        className="h-8 w-24 text-right"
      />
      <span className="text-xs text-fg-tertiary">руб./ч</span>
    </div>
  );
}

export function TeamRates({ users }: { users: TeamMemberDto[] }) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
      {users.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
          <span className="text-fg">
            {u.fullName}
            {u.position ? <span className="ml-2 text-xs text-fg-secondary">{u.position}</span> : null}
          </span>
          <div className="flex items-center gap-4">
            <RateInput userId={u.id} initial={u.hourlyRate} />
            <span className="text-xs text-fg-secondary">{u.roleLabel}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

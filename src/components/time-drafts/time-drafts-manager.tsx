'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDate, formatRubStr } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TimeDraftDto } from '@/server/services/time-drafts';
import type { CategoryDto } from '@/server/services/categories';

function DraftRow({
  draft,
  categories,
  onResolved,
}: {
  draft: TimeDraftDto;
  categories: CategoryDto[];
  onResolved: (id: string) => void;
}) {
  const { toast } = useToast();
  const [categoryId, setCategoryId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const approve = async () => {
    if (!categoryId) {
      toast('Выберите статью расхода', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/time-drafts/${draft.id}/approve`, { method: 'POST', body: { categoryId } });
      toast('Часы подтверждены — расход добавлен');
      onResolved(draft.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось подтвердить', 'error');
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/time-drafts/${draft.id}/reject`, { method: 'POST' });
      toast('Отклонено');
      onResolved(draft.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось отклонить', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-surface px-4 py-3 text-sm">
      <div className="min-w-[12rem] flex-1">
        <div className="font-medium text-fg">{draft.projectName}</div>
        <div className="text-xs text-fg-secondary">
          {draft.employeeName} · {formatDate(new Date(draft.workDate))}
        </div>
      </div>
      <div className="text-right tabular-nums">
        <div className="text-fg">{draft.hours} ч</div>
        <div className="text-xs text-fg-tertiary">
          {draft.amount ? formatRubStr(draft.amount) : 'нет ставки'}
        </div>
      </div>
      <div className="w-48">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Статья расхода" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={approve} disabled={busy || !draft.amount}>
        <Check className="size-3.5" />
        Подтвердить
      </Button>
      <Button size="sm" variant="ghost" onClick={reject} disabled={busy}>
        <X className="size-3.5" />
        Отклонить
      </Button>
    </div>
  );
}

export function TimeDraftsManager({
  initial,
  expenseCategories,
}: {
  initial: TimeDraftDto[];
  expenseCategories: CategoryDto[];
}) {
  const [drafts, setDrafts] = React.useState(initial);

  const onResolved = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  if (drafts.length === 0) {
    return <p className="text-sm text-fg-tertiary">Нет часов, ожидающих подтверждения.</p>;
  }

  return (
    <div className="space-y-2">
      {drafts.map((d) => (
        <DraftRow key={d.id} draft={d} categories={expenseCategories} onResolved={onResolved} />
      ))}
    </div>
  );
}

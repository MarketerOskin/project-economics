'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { formatDateTime, formatRubStr } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IncomeDraftDto } from '@/server/services/crm-income-drafts';
import type { CategoryDto } from '@/server/services/categories';

function DraftRow({
  draft,
  categories,
  onResolved,
}: {
  draft: IncomeDraftDto;
  categories: CategoryDto[];
  onResolved: (id: string) => void;
}) {
  const { toast } = useToast();
  const [categoryId, setCategoryId] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const approve = async () => {
    if (!categoryId) {
      toast('Выберите статью дохода', 'error');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/income-drafts/${draft.id}/approve`, { method: 'POST', body: { categoryId } });
      toast('Сумма подтверждена — доход обновлён');
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
      await apiFetch(`/api/income-drafts/${draft.id}/reject`, { method: 'POST' });
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
        <div className="text-xs text-fg-secondary">Сумма в Битрикс24 обновлена {formatDateTime(new Date(draft.syncedAt))}</div>
      </div>
      <div className="text-right tabular-nums text-fg">{formatRubStr(draft.crmAmount)}</div>
      <div className="w-48">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Статья дохода" />
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
      <Button size="sm" onClick={approve} disabled={busy}>
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

export function IncomeDraftsManager({
  initial,
  incomeCategories,
}: {
  initial: IncomeDraftDto[];
  incomeCategories: CategoryDto[];
}) {
  const [drafts, setDrafts] = React.useState(initial);

  const onResolved = (id: string) => setDrafts((prev) => prev.filter((d) => d.id !== id));

  if (drafts.length === 0) {
    return <p className="text-sm text-fg-tertiary">Суммы сделок совпадают с записанным доходом — подтверждать нечего.</p>;
  }

  return (
    <div className="space-y-2">
      {drafts.map((d) => (
        <DraftRow key={d.id} draft={d} categories={incomeCategories} onResolved={onResolved} />
      ))}
    </div>
  );
}

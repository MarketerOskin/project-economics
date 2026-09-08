'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Pencil, Copy, Trash2, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatRubStr, formatDate } from '@/lib/format';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntryForm, type EntryFormInitial } from './entry-form';
import type { EntryRow } from '@/server/services/finance-read';

const DIRECTION_LABEL = { INCOME: 'Доход', EXPENSE: 'Расход' } as const;

function toInitial(e: EntryRow): EntryFormInitial {
  return {
    id: e.id,
    direction: e.direction,
    budgetType: e.budgetType,
    projectId: e.projectId,
    categoryId: e.category.id,
    operationDate: new Date(e.operationDate).toISOString().slice(0, 10),
    calculationMode: e.calculationMode,
    amount: e.amount,
    hours: e.hours,
    hourlyRate: e.hourlyRate,
    description: e.description,
    comment: e.comment,
    contractorName: e.contractorName,
    counterpartyName: e.counterpartyName,
    invoiceNumber: e.invoiceNumber,
    documentUrl: e.documentUrl,
  };
}

export function EntriesTable({
  rows,
  canMutate,
  showProject = true,
}: {
  rows: EntryRow[];
  canMutate: boolean;
  showProject?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<EntryRow | null>(null);
  const [duplicating, setDuplicating] = React.useState<EntryRow | null>(null);
  const [deleting, setDeleting] = React.useState<EntryRow | null>(null);

  const del = async (id: string) => {
    await apiFetch(`/api/finance/${id}`, { method: 'DELETE' });
    toast('Операция удалена');
    router.refresh();
  };

  return (
    <>
      <div className="overflow-x-auto rounded-[14px] border border-border bg-surface">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-fg-tertiary">
              <th className="px-4 py-2.5 text-left font-medium">Дата</th>
              <th className="px-4 py-2.5 text-left font-medium">План / факт</th>
              <th className="px-4 py-2.5 text-left font-medium">Тип</th>
              <th className="px-4 py-2.5 text-left font-medium">Статья</th>
              {showProject ? <th className="px-4 py-2.5 text-left font-medium">Проект</th> : null}
              <th className="px-4 py-2.5 text-left font-medium">Описание</th>
              <th className="px-4 py-2.5 text-right font-medium">Сумма</th>
              <th className="px-4 py-2.5 text-left font-medium">Автор</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.id}
                className={cn(
                  'border-b border-border last:border-0',
                  e.deletedAt && 'text-fg-tertiary line-through',
                )}
              >
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(new Date(e.operationDate))}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      e.budgetType === 'FACT'
                        ? 'bg-accent-soft text-accent'
                        : 'bg-surface-muted text-fg-tertiary',
                    )}
                  >
                    {e.budgetType === 'FACT' ? 'Факт' : 'План'}
                  </span>
                </td>
                <td className="px-4 py-3">{DIRECTION_LABEL[e.direction]}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: `var(--cat-${e.category.accentColor}, #999)` }}
                    />
                    {e.category.name}
                  </span>
                </td>
                {showProject ? <td className="px-4 py-3">{e.projectName}</td> : null}
                <td className="max-w-[220px] truncate px-4 py-3 text-fg-secondary">
                  {e.description ?? e.contractorName ?? e.counterpartyName ?? '—'}
                  {e.employee ? <span className="block text-xs text-fg-tertiary">{e.employee}</span> : null}
                </td>
                <td className="px-4 py-3 text-right nums">
                  {formatRubStr(e.amount)}
                  {e.calculationMode === 'HOURS_RATE' && e.hours && e.hourlyRate ? (
                    <div className="text-xs text-fg-tertiary">
                      {e.hours} ч × {formatRubStr(e.hourlyRate)}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-fg-tertiary">{e.author ?? '—'}</td>
                <td className="px-2 py-3">
                  {canMutate && !e.deletedAt ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="rounded-[6px] p-1 text-fg-tertiary hover:bg-surface-muted hover:text-fg">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setEditing(e)}>
                          <Pencil className="mr-2 size-3.5" /> Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setDuplicating(e)}>
                          <Copy className="mr-2 size-3.5" /> Дублировать
                        </DropdownMenuItem>
                        {e.documentUrl ? (
                          <DropdownMenuItem asChild>
                            <a href={e.documentUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 size-3.5" /> Документ
                            </a>
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onSelect={() => setDeleting(e)}
                          className="text-negative focus:bg-negative-soft"
                        >
                          <Trash2 className="mr-2 size-3.5" /> Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader title="Редактирование операции" />
          {editing ? (
            <EntryForm
              initial={toInitial(editing)}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(duplicating)} onOpenChange={(v) => !v && setDuplicating(null)}>
        <DialogContent>
          <DialogHeader title="Дублирование операции" description="Проверьте данные и сохраните" />
          {duplicating ? (
            <EntryForm
              initial={{ ...toInitial(duplicating), id: '' }}
              onDone={() => {
                setDuplicating(null);
                router.refresh();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Удалить операцию?"
        description={
          deleting
            ? `${DIRECTION_LABEL[deleting.direction]} ${formatRubStr(deleting.amount)} перестанет учитываться в показателях. Запись останется в истории.`
            : undefined
        }
        onConfirm={() => (deleting ? del(deleting.id) : undefined)}
      />
    </>
  );
}

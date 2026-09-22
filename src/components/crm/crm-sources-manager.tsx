'use client';

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { CrmImportSourceOption } from '@/server/services/crm-sources';

interface SmartProcessType {
  entityTypeId: number;
  title: string;
}

function AddSource({ onAdded }: { onAdded: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [types, setTypes] = React.useState<SmartProcessType[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const openPicker = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const r = await apiFetch<{ types: SmartProcessType[] }>('/api/crm/smart-process-types');
      setTypes(r.types);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось загрузить смарт-процессы', 'error');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const add = async (entityTypeId: number) => {
    try {
      await apiFetch('/api/crm/sources', { method: 'POST', body: { entityTypeId } });
      toast('Источник добавлен');
      setOpen(false);
      onAdded();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось добавить источник', 'error');
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={openPicker}>
        <Plus className="size-3.5" />
        Добавить смарт-процесс
      </Button>
    );
  }

  return (
    <div className="space-y-1 rounded-[10px] border border-dashed border-border p-2">
      {loading ? (
        <p className="px-2 py-3 text-center text-sm text-fg-tertiary">Загрузка…</p>
      ) : !types || types.length === 0 ? (
        <p className="px-2 py-3 text-center text-sm text-fg-tertiary">
          Все смарт-процессы портала уже добавлены
        </p>
      ) : (
        types.map((t) => (
          <button
            key={t.entityTypeId}
            type="button"
            onClick={() => add(t.entityTypeId)}
            className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm hover:bg-surface-muted"
          >
            {t.title}
          </button>
        ))
      )}
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Отмена
      </Button>
    </div>
  );
}

export function CrmSourcesManager({ initial }: { initial: CrmImportSourceOption[] }) {
  const { toast } = useToast();
  const [sources, setSources] = React.useState(initial);
  const [confirmRemove, setConfirmRemove] = React.useState<CrmImportSourceOption | null>(null);

  const reload = React.useCallback(async () => {
    const r = await apiFetch<{ sources: CrmImportSourceOption[] }>('/api/crm/sources');
    setSources(r.sources);
  }, []);

  const remove = async (id: string) => {
    try {
      await apiFetch(`/api/crm/sources/${id}`, { method: 'DELETE' });
      toast('Источник удалён');
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось удалить источник', 'error');
    }
  };

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
        {sources.map((s) => (
          <li key={`${s.entityTypeId}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <span className="text-fg">{s.label}</span>
            {s.removable && s.id ? (
              <button
                onClick={() => setConfirmRemove(s)}
                className="rounded-[6px] p-1 text-fg-tertiary hover:bg-negative-soft hover:text-negative"
                aria-label="Удалить"
              >
                <Trash2 className="size-3.5" />
              </button>
            ) : (
              <span className="text-xs text-fg-tertiary">встроенный</span>
            )}
          </li>
        ))}
      </ul>
      <AddSource onAdded={reload} />
      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(v) => !v && setConfirmRemove(null)}
        title="Удалить источник?"
        description={`«${confirmRemove?.label}» больше нельзя будет выбрать при создании проекта из CRM.`}
        onConfirm={() => {
          if (confirmRemove?.id) return remove(confirmRemove.id);
        }}
      />
    </div>
  );
}

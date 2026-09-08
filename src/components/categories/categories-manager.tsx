'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Archive, ArchiveRestore, Trash2, Check, X, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { cn } from '@/lib/cn';
import { CATEGORY_COLORS, colorHex } from '@/lib/categories/palette';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { CategoryDto } from '@/server/services/categories';

function ColorDots({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1.5">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            'size-5 rounded-full ring-offset-1 transition-transform',
            value === c ? 'ring-2 ring-fg' : 'hover:scale-110',
          )}
          style={{ backgroundColor: colorHex(c) }}
        />
      ))}
    </div>
  );
}

function CategoryRow({ cat, onChanged }: { cat: CategoryDto; onChanged: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(cat.name);
  const [color, setColor] = React.useState(cat.accentColor);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const save = async () => {
    try {
      await apiFetch(`/api/categories/${cat.id}`, { method: 'PATCH', body: { name, accentColor: color } });
      toast('Статья обновлена');
      setEditing(false);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить статью', 'error');
    }
  };
  const toggleArchive = async () => {
    try {
      await apiFetch(`/api/categories/${cat.id}`, { method: 'PATCH', body: { isArchived: !cat.isArchived } });
      toast(cat.isArchived ? 'Статья восстановлена' : 'Статья архивирована');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось изменить статью', 'error');
    }
  };
  const remove = async () => {
    try {
      await apiFetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
      toast('Статья удалена');
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось удалить', 'error');
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-2',
        cat.isArchived && 'opacity-60',
      )}
    >
      {editing ? (
        <>
          <ColorDots value={color} onChange={setColor} />
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 flex-1" />
          <Button size="sm" onClick={save}>
            <Check className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="size-3.5" />
          </Button>
        </>
      ) : (
        <>
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: colorHex(cat.accentColor) }}
          />
          <span className="flex-1 text-sm">
            {cat.name}
            {cat.isSystem ? (
              <span className="ml-2 text-xs text-fg-tertiary">системная</span>
            ) : null}
            {cat.usageCount > 0 ? (
              <span className="ml-2 text-xs text-fg-tertiary">
                в {cat.usageCount} операц.
              </span>
            ) : null}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="rounded-[6px] p-1 text-fg-tertiary hover:bg-surface-muted hover:text-fg"
            aria-label="Редактировать"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={toggleArchive}
            className="rounded-[6px] p-1 text-fg-tertiary hover:bg-surface-muted hover:text-fg"
            aria-label={cat.isArchived ? 'Восстановить' : 'Архивировать'}
          >
            {cat.isArchived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={cat.usageCount > 0}
            title={cat.usageCount > 0 ? 'Статья используется — только архивирование' : 'Удалить'}
            className="rounded-[6px] p-1 text-fg-tertiary hover:bg-negative-soft hover:text-negative disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Удалить"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Удалить статью?"
        description={`«${cat.name}» будет удалена без возможности восстановления.`}
        onConfirm={remove}
      />
    </div>
  );
}

function AddCategory({ kind, onChanged }: { kind: 'INCOME' | 'EXPENSE'; onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState('graphite');

  const create = async () => {
    if (!name.trim()) return;
    try {
      await apiFetch('/api/categories', { method: 'POST', body: { kind, name, accentColor: color } });
      toast('Статья создана');
      setName('');
      setOpen(false);
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось создать статью', 'error');
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" />
        Добавить статью
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-border px-3 py-2">
      <ColorDots value={color} onChange={setColor} />
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        placeholder="Название статьи"
        className="h-8 flex-1"
      />
      <Button size="sm" onClick={create}>
        Создать
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Отмена
      </Button>
    </div>
  );
}

export function CategoriesManager({ initial }: { initial: CategoryDto[] }) {
  const router = useRouter();
  const [cats, setCats] = React.useState(initial);

  const reload = React.useCallback(async () => {
    const r = await apiFetch<{ categories: CategoryDto[] }>('/api/categories?includeArchived=true');
    setCats(r.categories);
    router.refresh();
  }, [router]);

  const groups: [string, 'INCOME' | 'EXPENSE'][] = [
    ['Доходы', 'INCOME'],
    ['Расходы', 'EXPENSE'],
  ];

  return (
    <div className="grid max-w-3xl gap-8 md:grid-cols-2">
      {groups.map(([label, kind]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-sm font-medium text-fg-secondary">{label}</h2>
          {cats
            .filter((c) => c.kind === kind)
            .map((c) => (
              <CategoryRow key={c.id} cat={c} onChanged={reload} />
            ))}
          <AddCategory kind={kind} onChanged={reload} />
        </section>
      ))}
    </div>
  );
}

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Archive / restore / delete a project (ADR-042). */
export function ProjectActions({
  projectId,
  name,
  archived,
  canArchive,
  canDelete,
}: {
  projectId: string;
  name: string;
  archived: boolean;
  canArchive: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, setConfirm] = React.useState<'archive' | 'delete' | null>(null);

  if (!canArchive && !canDelete) return null;

  const setArchived = async (value: boolean) => {
    try {
      await apiFetch(`/api/projects/${projectId}/archive`, {
        method: 'POST',
        body: { archived: value },
      });
      toast(value ? 'Проект в архиве' : 'Проект снова активен');
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не удалось изменить проект', 'error');
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      toast('Проект удалён');
      router.push('/projects');
      router.refresh();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Не удалось удалить проект', 'error');
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" aria-label="Действия с проектом">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {canArchive ? (
            archived ? (
              <DropdownMenuItem onSelect={() => setArchived(false)}>
                <ArchiveRestore className="mr-2 size-3.5" />
                Вернуть из архива
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => setConfirm('archive')}>
                <Archive className="mr-2 size-3.5" />В архив
              </DropdownMenuItem>
            )
          ) : null}
          {canDelete ? (
            <DropdownMenuItem onSelect={() => setConfirm('delete')} className="text-negative">
              <Trash2 className="mr-2 size-3.5" />
              Удалить
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Отправить «${name}» в архив?`}
        description="Проект пропадёт из списка активных, из дашборда и аналитики. Финансы сохранятся, проект можно вернуть в любой момент."
        confirmLabel="В архив"
        destructive={false}
        onConfirm={() => setArchived(true)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Удалить «${name}» навсегда?`}
        description="Удалить можно только проект без операций. Если по проекту есть доходы или расходы, отправьте его в архив."
        onConfirm={remove}
      />
    </>
  );
}

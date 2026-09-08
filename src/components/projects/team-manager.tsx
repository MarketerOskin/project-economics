'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { useToast } from '@/lib/client/toast';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/text';
import { MemberSelect } from './member-select';

interface Member {
  id: string;
  fullName: string;
  photoUrl: string | null;
  position: string | null;
}

export function TeamManager({
  projectId,
  members,
  canManage,
}: {
  projectId: string;
  members: Member[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [selected, setSelected] = React.useState(members.map((m) => m.id));
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/projects/${projectId}/members`, {
        method: 'PUT',
        body: { userIds: selected },
      });
      toast('Команда обновлена');
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="max-w-md space-y-4">
        <MemberSelect value={selected} onChange={setSelected} />
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-3">
      {members.length === 0 ? (
        <p className="text-sm text-fg-tertiary">В проекте пока нет сотрудников</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-[10px] border border-border bg-surface px-3 py-2">
              <Avatar>
                {m.photoUrl ? <AvatarImage src={m.photoUrl} alt="" /> : null}
                <AvatarFallback>{initials(m.fullName)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium">{m.fullName}</div>
                {m.position ? <div className="text-xs text-fg-tertiary">{m.position}</div> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Изменить состав
        </Button>
      ) : null}
    </div>
  );
}

'use client';

import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/text';

interface UserOption {
  id: string;
  fullName: string;
  photoUrl: string | null;
  position: string | null;
}

export function MemberSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [q, setQ] = React.useState('');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    apiFetch<{ users: UserOption[] }>('/api/users')
      .then((r) => setUsers(r.users))
      .catch(() => setUsers([]));
  }, []);

  const selected = users.filter((u) => value.includes(u.id));
  const filtered = q
    ? users.filter((u) => u.fullName.toLowerCase().includes(q.toLowerCase()))
    : users;

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-[10px] border border-border bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            <span className={cn(selected.length === 0 && 'text-fg-tertiary')}>
              {selected.length === 0 ? 'Выберите сотрудников' : `Выбрано: ${selected.length}`}
            </span>
            <ChevronsUpDown className="size-3.5 text-fg-tertiary" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            className="z-50 w-[--radix-popover-trigger-width] overflow-hidden rounded-[12px] border border-border bg-surface shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-3.5 text-fg-tertiary" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Поиск"
                className="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-tertiary"
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-fg-tertiary">Никого не найдено</div>
              ) : (
                filtered.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left text-sm hover:bg-surface-muted"
                  >
                    <Avatar className="size-6">
                      {u.photoUrl ? <AvatarImage src={u.photoUrl} alt="" /> : null}
                      <AvatarFallback className="text-[10px]">{initials(u.fullName)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1">
                      {u.fullName}
                      {u.position ? (
                        <span className="block text-xs text-fg-tertiary">{u.position}</span>
                      ) : null}
                    </span>
                    {value.includes(u.id) ? <Check className="size-4 text-accent" /> : null}
                  </button>
                ))
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface py-0.5 pl-1 pr-2 text-xs"
            >
              <Avatar className="size-4">
                {u.photoUrl ? <AvatarImage src={u.photoUrl} alt="" /> : null}
                <AvatarFallback className="text-[8px]">{initials(u.fullName)}</AvatarFallback>
              </Avatar>
              {u.fullName}
              <button type="button" onClick={() => toggle(u.id)} aria-label={`Убрать ${u.fullName}`}>
                <X className="size-3 text-fg-tertiary hover:text-fg" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

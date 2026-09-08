'use client';

import { useSession } from '@/lib/client/session';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { initials } from '@/lib/text';

const ROLE_LABEL = {
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель',
  EMPLOYEE: 'Сотрудник',
} as const;

export function UserBadge() {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="h-9 w-40 animate-pulse rounded-[10px] bg-surface-muted" />;
  }
  if (!session) return null;

  return (
    <div className="flex items-center gap-2.5">
      <Avatar>
        {session.user.photoUrl ? <AvatarImage src={session.user.photoUrl} alt="" /> : null}
        <AvatarFallback>{initials(session.user.fullName)}</AvatarFallback>
      </Avatar>
      <div className="leading-tight">
        <div className="text-sm font-medium">{session.user.fullName}</div>
        <div className="text-xs text-fg-tertiary">
          {session.user.position ?? ROLE_LABEL[session.role]}
        </div>
      </div>
    </div>
  );
}

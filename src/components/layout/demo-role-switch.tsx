'use client';

import type { AppRole } from '@prisma/client';
import { ChevronsUpDown } from 'lucide-react';
import { useSession } from '@/lib/client/session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_LABEL: Record<AppRole, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Руководитель',
  EMPLOYEE: 'Сотрудник',
};

/**
 * Demo-only role switcher (ТЗ §5). Renders nothing outside demo mode — production
 * never shows this control.
 */
export function DemoRoleSwitch() {
  const { session, switchRole } = useSession();
  if (!session?.demo) return null;

  return (
    <div className="rounded-[12px] border border-dashed border-[#d6ff3f]/35 bg-[#d6ff3f]/[0.08] p-2 in-data-[theme=light]:border-black/[0.12] in-data-[theme=light]:bg-[#d6ff3f]/25">
      <div className="text-fg-tertiary px-1 pb-1 text-[11px]">Демо-режим</div>
      <DropdownMenu>
        <DropdownMenuTrigger className="focus-visible:ring-accent flex w-full items-center justify-between rounded-[10px] bg-white/5 px-2.5 py-2 text-sm font-semibold outline-none focus-visible:ring-2 in-data-[theme=light]:bg-white in-data-[theme=light]:shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
          <span>{ROLE_LABEL[session.role]}</span>
          <ChevronsUpDown className="text-fg-tertiary size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[--radix-dropdown-menu-trigger-width]">
          <DropdownMenuLabel>Войти как</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.keys(ROLE_LABEL) as AppRole[]).map((role) => (
            <DropdownMenuCheckboxItem
              key={role}
              checked={session.role === role}
              onSelect={(e) => {
                e.preventDefault();
                if (session.role !== role) void switchRole(role);
              }}
            >
              {ROLE_LABEL[role]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

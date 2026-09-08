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
    <div className="rounded-[12px] border border-dashed border-border bg-accent-soft/40 p-2">
      <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
        Демо-режим
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center justify-between rounded-[8px] bg-surface px-2.5 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <span>{ROLE_LABEL[session.role]}</span>
          <ChevronsUpDown className="size-3.5 text-fg-tertiary" />
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

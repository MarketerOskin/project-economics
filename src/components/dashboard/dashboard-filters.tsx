'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Opt {
  value: string;
  label: string;
}

const STATUS_OPTS: Opt[] = [
  { value: 'ACTIVE', label: 'Активные' },
  { value: 'COMPLETED', label: 'Завершённые' },
  { value: 'ARCHIVED', label: 'Архив' },
  { value: 'ALL', label: 'Все' },
];

const FILTER_KEYS = ['projectId', 'status', 'employeeId', 'categoryId'] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function FilterSection({
  label,
  allLabel,
  options,
  selected,
  onPick,
}: {
  label: string;
  allLabel: string;
  options: Opt[];
  selected: string;
  onPick: (value: string) => void;
}) {
  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        checked={selected === ''}
        onSelect={(e) => {
          e.preventDefault();
          onPick('');
        }}
      >
        {allLabel}
      </DropdownMenuCheckboxItem>
      {options.map((o) => (
        <DropdownMenuCheckboxItem
          key={o.value}
          checked={selected === o.value}
          onSelect={(e) => {
            e.preventDefault();
            onPick(selected === o.value ? '' : o.value);
          }}
        >
          {o.label}
        </DropdownMenuCheckboxItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}

export function DashboardFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const [projects, setProjects] = React.useState<Opt[]>([]);
  const [users, setUsers] = React.useState<Opt[]>([]);
  const [categories, setCategories] = React.useState<Opt[]>([]);

  React.useEffect(() => {
    apiFetch<{ projects: { id: string; name: string }[] }>('/api/projects?status=ALL')
      .then((r) => setProjects(r.projects.map((p) => ({ value: p.id, label: p.name }))))
      .catch(() => undefined);
    apiFetch<{ users: { id: string; fullName: string }[] }>('/api/users')
      .then((r) => setUsers(r.users.map((u) => ({ value: u.id, label: u.fullName }))))
      .catch(() => undefined);
    apiFetch<{ categories: { id: string; name: string }[] }>('/api/categories')
      .then((r) => setCategories(r.categories.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => undefined);
  }, []);

  const set = (key: FilterKey, value: string) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    router.replace(`/?${next.toString()}`);
  };

  const activeKeys = FILTER_KEYS.filter((k) => params.get(k));
  const get = (k: FilterKey) => params.get(k) ?? '';

  return (
    <div className="flex items-center gap-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-[10px] border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
            activeKeys.length > 0
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface',
          )}
        >
          <SlidersHorizontal className="size-4" />
          Фильтры
          {activeKeys.length > 0 ? (
            <span className="rounded-full bg-accent px-1.5 text-xs text-accent-fg">
              {activeKeys.length}
            </span>
          ) : null}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-[70vh] w-64 overflow-y-auto">
          <FilterSection
            label="Статус проекта"
            allLabel="Активные и завершённые"
            options={STATUS_OPTS}
            selected={get('status')}
            onPick={(v) => set('status', v)}
          />
          <FilterSection
            label="Проект"
            allLabel="Все проекты"
            options={projects}
            selected={get('projectId')}
            onPick={(v) => set('projectId', v)}
          />
          <FilterSection
            label="Сотрудник"
            allLabel="Все сотрудники"
            options={users}
            selected={get('employeeId')}
            onPick={(v) => set('employeeId', v)}
          />
          <FilterSection
            label="Статья"
            allLabel="Все статьи"
            options={categories}
            selected={get('categoryId')}
            onPick={(v) => set('categoryId', v)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {activeKeys.length > 0 ? (
        <button
          onClick={() => {
            const next = new URLSearchParams(params);
            for (const k of activeKeys) next.delete(k);
            router.replace(`/?${next.toString()}`);
          }}
          className="inline-flex h-9 items-center rounded-[10px] border border-border bg-surface px-2.5 text-sm text-fg-secondary hover:text-fg"
          aria-label="Сбросить фильтры"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
